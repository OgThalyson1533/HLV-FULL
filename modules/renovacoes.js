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
            ${r.whatsapp ? `<a href="https://wa.me/55${r.whatsapp.replace(/\D/g,'')}" target="_blank" class="btn btn-sm btn-secondary"><span class="material-symbols-rounded" style="font-size:13px;color:#25d366">chat</span></a>` : ''}
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
