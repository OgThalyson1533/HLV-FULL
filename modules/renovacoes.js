// modules/renovacoes.js — Controle Comercial de Renovações
import { supabase, mostrarToast } from '../js/app.js';

let state = { pagina: 1, filtroNivel: '', filtroCurso: '', busca: '', cursos: [] };
const PAGE_SIZE = 25;

export async function renderRenovacoes() {
  document.getElementById('topbar-title').textContent = 'Renovações';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>RENOVAÇÕES</h1><p>Alertas e CRM de renovação de certificados</p></div>
    </div>
    <div class="stats-grid" id="stats-ren"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div class="card" id="card-criticos"></div>
      <div class="card" id="card-metricas"></div>
    </div>

    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-ren" placeholder="Buscar aluno ou empresa..." /></div>
        <select id="filtro-nivel-ren" style="width:180px">
          <option value="">Todos os alertas</option>
          <option value="vencido">Vencidos</option>
          <option value="critico_30d">Crítico (30d)</option>
          <option value="atencao_60d">Atenção (60d)</option>
          <option value="aviso_90d">Aviso (90d)</option>
        </select>
        <select id="filtro-curso-ren" style="width:200px"><option value="">Todos os cursos</option></select>
      </div>
      <div id="tabela-ren-wrap"></div>
      <div class="table-footer">
        <span id="info-ren" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-ren"></div>
      </div>
    </div>

    <div style="margin-top:24px">
      <div class="page-header"><div class="page-header-left"><h1>HISTÓRICO DE CONTATOS</h1><p>Registros de abordagens comerciais</p></div></div>
      <div class="table-container"><div id="tabela-contatos-wrap"></div></div>
    </div>`;

  document.getElementById('busca-ren').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  document.getElementById('filtro-nivel-ren').onchange = e => { state.filtroNivel = e.target.value; state.pagina = 1; carregar(); };
  document.getElementById('filtro-curso-ren').onchange = e => { state.filtroCurso = e.target.value; state.pagina = 1; carregar(); };

  await Promise.all([carregarCursos(), carregarStats(), carregar(), carregarCriticos(), carregarMetricas(), carregarContatos()]);
  popularFiltroCurso();
}

async function carregarCursos() { const { data } = await supabase.from('cursos').select('id,nome').eq('ativo', true).order('nome'); state.cursos = data || []; }
function popularFiltroCurso() {
  const sel = document.getElementById('filtro-curso-ren');
  if (!sel) return;
  state.cursos.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome; sel.appendChild(o); });
}

async function carregarStats() {
  const { data } = await supabase.from('vw_alertas_renovacao').select('nivel_alerta');
  const counts = { vencido: 0, critico_30d: 0, atencao_60d: 0, aviso_90d: 0 };
  (data || []).forEach(r => { if (counts[r.nivel_alerta] !== undefined) counts[r.nivel_alerta]++; });
  document.getElementById('stats-ren').innerHTML = [
    { icon: 'running_with_errors', label: 'Vencidos', value: counts.vencido, cor: 'var(--danger)' },
    { icon: 'warning', label: 'Crítico (30d)', value: counts.critico_30d, cor: 'var(--danger)' },
    { icon: 'schedule', label: 'Atenção (60d)', value: counts.atencao_60d, cor: 'var(--warning)' },
    { icon: 'notifications', label: 'Aviso (90d)', value: counts.aviso_90d, cor: 'var(--info)' },
  ].map(s => `<div class="stat-card"><div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div>
    <div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
}

async function carregarCriticos() {
  const { data } = await supabase.from('vw_alertas_renovacao').select('*').in('nivel_alerta', ['vencido','critico_30d']).order('data_validade').limit(8);
  const el = document.getElementById('card-criticos');
  if (!el) return;
  el.innerHTML = `<div class="card-header"><span class="card-title">🚨 ALERTAS CRÍTICOS</span></div>
    ${!data?.length ? '<div class="empty-state" style="padding:20px"><p>Nenhum alerta crítico</p></div>' :
    data.map(r => {
      const dias = r.dias_vencido;
      const cor = dias > 0 ? 'var(--danger)' : 'var(--warning)';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="font-weight:600;font-size:13px">${r.aluno_nome}</div>
          <div class="text-xs text-muted">${r.curso_nome}${r.empresa_nome ? ' · ' + r.empresa_nome : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="color:${cor};font-weight:700;font-size:12px">${dias > 0 ? dias + 'd vencido' : Math.abs(dias) + 'd restantes'}</div>
          <button class="btn btn-sm btn-secondary" onclick="window._registrarContato('${r.certificado_id}','${r.aluno_id}','${r.curso_id}','${encodeURIComponent(r.aluno_nome)}','${r.empresa_id||''}')">
            <span class="material-symbols-rounded" style="font-size:13px">phone</span> Contatar
          </button>
        </div>
      </div>`;
    }).join('')}`;
}

async function carregarMetricas() {
  const { data } = await supabase.from('vw_metricas_renovacao').select('*').limit(10);
  const el = document.getElementById('card-metricas');
  if (!el) return;
  el.innerHTML = `<div class="card-header"><span class="card-title">📊 CONVERSÃO POR CURSO</span></div>
    ${!data?.length ? '<div class="empty-state" style="padding:20px"><p>Sem dados</p></div>' :
    `<table style="width:100%"><thead><tr><th>Curso</th><th>Contatos</th><th>Convertidos</th><th>Taxa</th></tr></thead><tbody>
      ${data.map(m => {
        const taxa = m.taxa_conversao_percent || 0;
        const cor = taxa >= 50 ? 'var(--success)' : taxa >= 25 ? 'var(--warning)' : 'var(--danger)';
        return `<tr>
          <td class="text-sm">${m.curso_nome}</td>
          <td class="text-sm text-muted">${m.total_contatos}</td>
          <td class="text-sm">${m.total_convertidos}</td>
          <td><span style="color:${cor};font-weight:700;font-family:var(--font-mono)">${taxa}%</span></td>
        </tr>`;
      }).join('')}</tbody></table>`}`;
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('vw_alertas_renovacao').select('*', { count: 'exact' }).order('data_validade').range(from, from + PAGE_SIZE - 1);
  if (state.filtroNivel) q = q.eq('nivel_alerta', state.filtroNivel);
  if (state.filtroCurso) q = q.eq('curso_id', state.filtroCurso);
  if (state.busca) q = q.or(`aluno_nome.ilike.%${state.busca}%,empresa_nome.ilike.%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro', 'error'); return; }
  renderTabela(data);
  document.getElementById('info-ren').textContent = `${count} alertas`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-ren').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgRen(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgRen(${state.pagina + 1})">›</button>`;
  window._pgRen = p => { state.pagina = p; carregar(); };
}

const nivelConfig = {
  vencido:      { badge: 'badge-danger',  label: 'Vencido' },
  critico_30d:  { badge: 'badge-danger',  label: 'Crítico 30d' },
  atencao_60d:  { badge: 'badge-warning', label: 'Atenção 60d' },
  aviso_90d:    { badge: 'badge-info',    label: 'Aviso 90d' },
};

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-ren-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">autorenew</span><p>Nenhum alerta no período</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Aluno</th><th>Empresa</th><th>Curso</th><th>Validade</th><th>Situação</th><th>Último Contato</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(r => {
      const nc = nivelConfig[r.nivel_alerta] || { badge: 'badge-neutral', label: r.nivel_alerta };
      const dias = r.dias_vencido;
      return `<tr>
        <td><strong>${r.aluno_nome}</strong><br><span class="text-xs text-muted">${r.telefone || r.whatsapp || r.email || '—'}</span></td>
        <td class="text-sm text-muted">${r.empresa_nome || '—'}</td>
        <td class="text-sm">${r.curso_nome}</td>
        <td class="text-sm">
          ${fmtData(r.data_validade)}<br>
          <span class="${dias > 0 ? 'text-danger' : 'text-muted'} text-xs">${dias > 0 ? dias + 'd vencido' : Math.abs(dias) + 'd restantes'}</span>
        </td>
        <td><span class="badge ${nc.badge}">${nc.label}</span></td>
        <td class="text-sm text-muted">${r.ultimo_contato ? new Date(r.ultimo_contato).toLocaleDateString('pt-BR') : '<span style="color:var(--danger)">Sem contato</span>'}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="window._registrarContato('${r.certificado_id}','${r.aluno_id}','${r.curso_id}','${encodeURIComponent(r.aluno_nome)}','${r.empresa_id||''}')">
              <span class="material-symbols-rounded" style="font-size:13px">add_call</span> Contato
            </button>
            ${r.whatsapp || r.telefone ? `<button class="btn btn-sm" onclick="window._wppRenovacao('${r.certificado_id}','${encodeURIComponent(r.aluno_nome)}','${encodeURIComponent(r.curso_nome)}','${r.cert_validade||''}','${r.whatsapp||r.telefone||''}')" style="background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.3);color:#25d366">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#25d366" style="vertical-align:middle"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WA
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function carregarContatos() {
  const { data } = await supabase.from('contatos_renovacao').select('*, alunos(nome), cursos(nome)').order('data_contato', { ascending: false }).limit(20);
  const wrap = document.getElementById('tabela-contatos-wrap');
  if (!wrap) return;
  if (!data?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">contact_phone</span><p>Nenhum contato registrado</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Data</th><th>Aluno</th><th>Curso</th><th>Canal</th><th>Resultado</th><th>Próxima Ação</th><th>Converteu?</th></tr></thead>
    <tbody>${data.map(c => `<tr>
      <td class="text-sm">${new Date(c.data_contato).toLocaleDateString('pt-BR')}</td>
      <td>${c.alunos?.nome || '—'}</td>
      <td class="text-sm text-muted">${c.cursos?.nome || '—'}</td>
      <td><span class="badge badge-info">${c.origem}</span></td>
      <td class="text-sm">${c.resultado || '—'}</td>
      <td class="text-sm">${c.proxima_acao || '—'}${c.data_proxima_acao ? ` (${fmtData(c.data_proxima_acao)})` : ''}</td>
      <td>${c.converteu ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-neutral">Não</span>'}</td>
    </tr>`).join('')}</tbody></table>`;
}

window._registrarContato = (certId, alunoId, cursoId, nomeEnc, empresaId) => {
  const nomeAluno = decodeURIComponent(nomeEnc);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-header"><h2>Registrar Contato</h2><button class="btn-icon" id="fc-cont"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body">
      <div style="padding:12px;background:var(--bg-elevated);border-radius:8px;margin-bottom:16px">
        <div class="text-xs text-muted">Aluno</div><div style="font-weight:600">${nomeAluno}</div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Canal *</label><select id="cont-origem">
          <option value="telefone">Telefone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">E-mail</option>
          <option value="presencial">Presencial</option>
        </select></div>
        <div class="form-group"><label>Data Próxima Ação</label><input type="date" id="cont-data-prox" /></div>
        <div class="form-group full"><label>Resultado do Contato</label><textarea id="cont-resultado" placeholder="O que foi conversado..."></textarea></div>
        <div class="form-group full"><label>Próxima Ação</label><input id="cont-prox" placeholder="Ex: Enviar proposta, Ligar novamente..." /></div>
        <div class="form-group"><label>Converteu (nova matrícula)?</label><select id="cont-conv">
          <option value="false">Não</option><option value="true">Sim</option>
        </select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-cont2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-contato"><span class="material-symbols-rounded">save</span> Registrar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-cont').onclick = fechar;
  document.getElementById('fc-cont2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.getElementById('salvar-contato').onclick = async () => {
    const resultado = document.getElementById('cont-resultado').value.trim();
    if (!resultado) { mostrarToast('Informe o resultado do contato', 'warning'); return; }
    try {
      await supabase.from('contatos_renovacao').insert({
        certificado_id: certId === 'null' ? null : certId,
        aluno_id: alunoId, curso_id: cursoId,
        empresa_id: empresaId || null,
        origem: document.getElementById('cont-origem').value,
        resultado, proxima_acao: document.getElementById('cont-prox').value.trim() || null,
        data_proxima_acao: document.getElementById('cont-data-prox').value || null,
        converteu: document.getElementById('cont-conv').value === 'true',
      });
      mostrarToast('Contato registrado!', 'success');
      fechar(); carregarContatos(); carregarCriticos(); carregarMetricas();
    } catch(e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
};

const fmtData = d => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ── WhatsApp de renovação ──────────────────────────────────
window._wppRenovacao = async (certId, nomeEnc, cursoEnc, validade, telefone) => {
  const { abrirModalWhatsApp, TEMPLATES } = await import('../js/whatsapp.js');
  const { getConfig } = await import('../js/supabase.js');
  const nomeEscola = await getConfig('nome_escola', 'TrainOS');
  const nomeAluno = decodeURIComponent(nomeEnc);
  const nomeCurso = decodeURIComponent(cursoEnc);
  const hoje = new Date();
  const val = validade ? new Date(validade) : null;
  const dias = val ? Math.floor((val - hoje) / 86400000) : null;
  const tipo = !val ? 'certificado_emitido' : val < hoje ? 'certificado_vencido' : dias < 60 ? 'certificado_a_vencer' : 'certificado_emitido';
  abrirModalWhatsApp(tipo, {
    nomeAluno, nomeCurso, nomeEscola,
    dataValidade: validade ? new Date(validade).toLocaleDateString('pt-BR') : null,
    diasRestantes: dias,
    codigoVerificacao: '—',
  }, telefone);
};
