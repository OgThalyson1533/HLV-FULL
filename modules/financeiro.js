// modules/financeiro.js — Gestão Financeira
import { supabase, mostrarToast } from '../js/app.js';

let state = { pagina: 1, filtroStatus: '', filtroTipo: '', busca: '', matriculas: [] };
const PAGE_SIZE = 25;

export async function renderFinanceiro() {
  document.getElementById('topbar-title').textContent = 'Financeiro';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>FINANCEIRO</h1><p>Controle de pagamentos e recebimentos</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-novo-pgto"><span class="material-symbols-rounded">add</span> Novo Pagamento</button>
      </div>
    </div>
    <div class="stats-grid" id="stats-fin"></div>
    <div id="grafico-mensal" class="card" style="margin-bottom:24px"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-fin" placeholder="Buscar aluno ou recibo..." /></div>
        <select id="filtro-status-fin" style="width:140px">
          <option value="">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="recebido">Recebido</option>
          <option value="atraso">Em Atraso</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select id="filtro-tipo-fin" style="width:160px">
          <option value="">Todos os tipos</option>
          <option value="pix">PIX</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="boleto">Boleto</option>
          <option value="cartao_credito">Cartão Crédito</option>
          <option value="cartao_debito">Cartão Débito</option>
          <option value="faturado_empresa">Faturado (B2B)</option>
        </select>
      </div>
      <div id="tabela-fin-wrap"></div>
      <div class="table-footer">
        <span id="info-fin" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-fin"></div>
      </div>
    </div>`;

  document.getElementById('btn-novo-pgto').onclick = () => abrirModal();
  document.getElementById('busca-fin').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  document.getElementById('filtro-status-fin').onchange = e => { state.filtroStatus = e.target.value; state.pagina = 1; carregar(); };
  document.getElementById('filtro-tipo-fin').onchange = e => { state.filtroTipo = e.target.value; state.pagina = 1; carregar(); };

  await Promise.all([carregarStats(), carregar(), carregarGraficoMensal()]);
}

async function carregarStats() {
  const hoje = new Date().toISOString().split('T')[0];
  const mes = new Date(); mes.setDate(1); const mesInicio = mes.toISOString().split('T')[0];
  const [recMes, pend, atraso, total] = await Promise.all([
    supabase.from('pagamentos').select('valor_recebido').eq('status', 'recebido').gte('data_recebimento', mesInicio),
    supabase.from('pagamentos').select('valor_cobrado').eq('status', 'pendente'),
    supabase.from('pagamentos').select('valor_cobrado').eq('status', 'atraso'),
    supabase.from('pagamentos').select('valor_recebido').eq('status', 'recebido'),
  ]);

  const soma = arr => (arr.data || []).reduce((s, r) => s + (parseFloat(r.valor_recebido || r.valor_cobrado) || 0), 0);
  const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  document.getElementById('stats-fin').innerHTML = [
    { icon: 'payments', label: 'Recebido (Mês)', value: fmt(soma(recMes)), cor: 'var(--success)' },
    { icon: 'pending', label: 'Pendente', value: fmt(soma(pend)), cor: 'var(--warning)' },
    { icon: 'warning', label: 'Em Atraso', value: fmt(soma(atraso)), cor: 'var(--danger)' },
    { icon: 'account_balance', label: 'Total Recebido', value: fmt(soma(total)), cor: 'var(--accent)' },
  ].map(s => `<div class="stat-card"><div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div>
    <div class="stat-value" style="font-size:18px">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
}

async function carregarGraficoMensal() {
  const { data } = await supabase.from('vw_financeiro_resumo').select('*').limit(6);
  if (!data?.length) { document.getElementById('grafico-mensal').innerHTML = `<div class="card-title">Recebimentos por Mês</div><div class="empty-state" style="padding:20px"><span class="material-symbols-rounded">bar_chart</span><p>Sem dados</p></div>`; return; }
  const maxVal = Math.max(...data.map(d => parseFloat(d.total_recebido) || 0));
  document.getElementById('grafico-mensal').innerHTML = `
    <div class="card-header"><span class="card-title">RECEBIMENTOS POR MÊS</span></div>
    <div class="chart-bars">
      ${data.reverse().map(d => {
        const rec = parseFloat(d.total_recebido) || 0;
        const pend = parseFloat(d.total_pendente) || 0;
        const atr = parseFloat(d.total_em_atraso) || 0;
        const pct = maxVal > 0 ? (rec / maxVal * 100) : 0;
        const mes = new Date(d.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        return `<div class="chart-bar-group">
          <div class="chart-bar-wrap">
            <div class="chart-bar-value">R$ ${rec.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
            <div class="chart-bar" style="height:${Math.max(pct, 2)}%"></div>
          </div>
          <div class="chart-bar-label">${mes}</div>
        </div>`;
      }).join('')}
    </div>`;
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('pagamentos')
    .select('*, alunos(nome), empresas(nome_fantasia), matriculas(id)', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (state.filtroStatus) q = q.eq('status', state.filtroStatus);
  if (state.filtroTipo) q = q.eq('tipo_pagamento', state.filtroTipo);
  if (state.busca) q = q.or(`alunos.nome.ilike.%${state.busca}%,numero_recibo.ilike.%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro ao carregar', 'error'); return; }
  renderTabela(data);
  document.getElementById('info-fin').textContent = `${count} pagamentos`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-fin').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgFin(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgFin(${state.pagina + 1})">›</button>`;
  window._pgFin = p => { state.pagina = p; carregar(); };
}

const statusCorFin = { recebido: 'badge-success', pendente: 'badge-warning', atraso: 'badge-danger', cancelado: 'badge-neutral', isento: 'badge-info' };
const tipoLabel = { dinheiro:'Dinheiro', pix:'PIX', cartao_debito:'Débito', cartao_credito:'Crédito', boleto:'Boleto', transferencia:'TED/DOC', faturado_empresa:'Faturado' };

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-fin-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">payments</span><p>Nenhum pagamento encontrado</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Recibo</th><th>Aluno / Empresa</th><th>Cobrado</th><th>Recebido</th><th>Vencimento</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(p => `<tr>
      <td class="mono text-sm">${p.numero_recibo || '—'}</td>
      <td><strong>${p.alunos?.nome || '—'}</strong>${p.empresas ? `<br><span class="text-muted text-xs">${p.empresas.nome_fantasia}</span>` : ''}</td>
      <td class="mono">R$ ${Number(p.valor_cobrado).toFixed(2)}</td>
      <td class="mono">${p.valor_recebido ? 'R$ ' + Number(p.valor_recebido).toFixed(2) : '—'}</td>
      <td class="text-sm ${p.status === 'atraso' ? 'text-danger' : ''}">${fmtData(p.data_vencimento)}</td>
      <td class="text-sm">${tipoLabel[p.tipo_pagamento] || p.tipo_pagamento || '—'}</td>
      <td><span class="badge ${statusCorFin[p.status] || 'badge-neutral'}">${p.status}</span></td>
      <td><div class="flex gap-2">
        ${p.status === 'pendente' || p.status === 'atraso' ? `<button class="btn btn-sm btn-secondary" onclick="window._confirmarPgto('${p.id}')"><span class="material-symbols-rounded" style="font-size:14px">check</span> Receber</button>` : ''}
        ${(p.status === 'pendente' || p.status === 'atraso') && p.aluno_id ? `<button class="btn-icon" title="Cobrança WhatsApp" onclick="window._wppCobranca('${p.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>` : ''}
        <button class="btn-icon" onclick="window._editPgto('${p.id}')"><span class="material-symbols-rounded">edit</span></button>
        ${p.numero_recibo ? `<button class="btn-icon" title="Ver Recibo" onclick="window._verRecibo('${p.id}')"><span class="material-symbols-rounded">receipt</span></button>` : ''}
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

window._confirmarPgto = async id => {
  const { data: p } = await supabase.from('pagamentos').select('*').eq('id', id).single();
  abrirModal(p, true);
};

window._editPgto = async id => { const { data } = await supabase.from('pagamentos').select('*').eq('id', id).single(); abrirModal(data); };

window._verRecibo = async id => {
  const { data: p } = await supabase.from('pagamentos').select('*, alunos(nome,cpf), matriculas(*, cursos(nome))').eq('id', id).single();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-header"><h2>Recibo Nº ${p.numero_recibo}</h2>
      <button class="btn-icon" id="fc-rec"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body" id="recibo-content">
      <div class="recibo-box">
        <div class="recibo-header"><span class="material-symbols-rounded" style="font-size:32px;color:var(--accent)">school</span><div><strong style="font-size:16px">TrainOS</strong><br><span class="text-sm text-muted">Escola de Treinamentos</span></div></div>
        <div class="section-divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
          <div><div class="text-xs text-muted">Aluno</div><strong>${p.alunos?.nome}</strong></div>
          <div><div class="text-xs text-muted">CPF</div>${p.alunos?.cpf || '—'}</div>
          <div><div class="text-xs text-muted">Curso</div>${p.matriculas?.cursos?.nome || '—'}</div>
          <div><div class="text-xs text-muted">Recibo Nº</div><span class="mono">${p.numero_recibo}</span></div>
          <div><div class="text-xs text-muted">Valor</div><strong style="color:var(--success);font-size:16px">R$ ${Number(p.valor_recebido || p.valor_cobrado).toFixed(2)}</strong></div>
          <div><div class="text-xs text-muted">Data Recebimento</div>${fmtData(p.data_recebimento)}</div>
          <div><div class="text-xs text-muted">Forma de Pagamento</div>${tipoLabel[p.tipo_pagamento] || '—'}</div>
          ${p.observacoes ? `<div class="full"><div class="text-xs text-muted">Obs.</div>${p.observacoes}</div>` : ''}
        </div>
        <div class="section-divider"></div>
        <div style="text-align:center;font-size:11px;color:var(--text-tertiary)">Documento emitido em ${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-rec2">Fechar</button>
      <button class="btn btn-primary" onclick="window.print()"><span class="material-symbols-rounded">print</span> Imprimir</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-rec').onclick = fechar;
  document.getElementById('fc-rec2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
};

async function abrirModal(p = null, modoReceber = false) {
  // Carregar matrículas disponíveis para associar
  if (!state.matriculas.length) {
    const { data } = await supabase.from('matriculas').select('id, alunos(nome), cursos(nome)').order('criado_em', { ascending: false }).limit(200);
    state.matriculas = data || [];
  }
  const matOpts = state.matriculas.map(m => `<option value="${m.id}" ${p?.matricula_id === m.id ? 'selected':''}>${m.alunos?.nome} — ${m.cursos?.nome}</option>`).join('');
  const v = p || {};
  const titulo = modoReceber ? 'Confirmar Recebimento' : (p ? 'Editar Pagamento' : 'Novo Pagamento');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${titulo}</h2>
      <button class="btn-icon" id="fc-pgto"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Matrícula *</label><select id="pg-mat"><option value="">Selecione...</option>${matOpts}</select></div>
      <div class="form-group"><label>Valor Cobrado (R$) *</label><input type="number" id="pg-cobrado" value="${v.valor_cobrado || ''}" min="0" step="0.01" /></div>
      <div class="form-group"><label>Desconto (R$)</label><input type="number" id="pg-desc" value="${v.desconto || 0}" min="0" step="0.01" /></div>
      <div class="form-group"><label>Vencimento</label><input type="date" id="pg-venc" value="${v.data_vencimento || ''}" /></div>
      <div class="form-group"><label>Status</label><select id="pg-status">
        <option value="pendente" ${v.status === 'pendente' || !v.status ? 'selected':''}>Pendente</option>
        <option value="recebido" ${v.status === 'recebido' || modoReceber ? 'selected':''}>Recebido</option>
        <option value="atraso" ${v.status === 'atraso' ? 'selected':''}>Em Atraso</option>
        <option value="cancelado" ${v.status === 'cancelado' ? 'selected':''}>Cancelado</option>
        <option value="isento" ${v.status === 'isento' ? 'selected':''}>Isento</option>
      </select></div>
      <div class="form-group"><label>Forma de Pagamento</label><select id="pg-tipo">
        <option value="">—</option>
        <option value="pix" ${v.tipo_pagamento==='pix'?'selected':''}>PIX</option>
        <option value="dinheiro" ${v.tipo_pagamento==='dinheiro'?'selected':''}>Dinheiro</option>
        <option value="cartao_credito" ${v.tipo_pagamento==='cartao_credito'?'selected':''}>Cartão Crédito</option>
        <option value="cartao_debito" ${v.tipo_pagamento==='cartao_debito'?'selected':''}>Cartão Débito</option>
        <option value="boleto" ${v.tipo_pagamento==='boleto'?'selected':''}>Boleto</option>
        <option value="transferencia" ${v.tipo_pagamento==='transferencia'?'selected':''}>TED/DOC</option>
        <option value="faturado_empresa" ${v.tipo_pagamento==='faturado_empresa'?'selected':''}>Faturado (B2B)</option>
      </select></div>
      <div class="form-group"><label>Valor Recebido (R$)</label><input type="number" id="pg-recebido" value="${v.valor_recebido || ''}" min="0" step="0.01" placeholder="Se diferente do cobrado" /></div>
      <div class="form-group"><label>Data Recebimento</label><input type="date" id="pg-datarec" value="${v.data_recebimento || (modoReceber ? new Date().toISOString().split('T')[0] : '')}" /></div>
      <div class="form-group full"><label>Observações</label><textarea id="pg-obs">${v.observacoes || ''}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-pgto2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-pgto"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-pgto').onclick = fechar;
  document.getElementById('fc-pgto2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });

  document.getElementById('salvar-pgto').onclick = async () => {
    const matricula_id = document.getElementById('pg-mat').value;
    const valor_cobrado = parseFloat(document.getElementById('pg-cobrado').value);
    if (!matricula_id || isNaN(valor_cobrado)) { mostrarToast('Matrícula e valor são obrigatórios', 'warning'); return; }
    const mat = state.matriculas.find(m => m.id === matricula_id);
    const valRec = parseFloat(document.getElementById('pg-recebido').value) || valor_cobrado;
    const payload = {
      matricula_id, valor_cobrado, desconto: parseFloat(document.getElementById('pg-desc').value) || 0,
      aluno_id: mat?.alunos?.id || v.aluno_id,
      status: document.getElementById('pg-status').value,
      tipo_pagamento: document.getElementById('pg-tipo').value || null,
      data_vencimento: document.getElementById('pg-venc').value || null,
      valor_recebido: valRec,
      data_recebimento: document.getElementById('pg-datarec').value || null,
      observacoes: document.getElementById('pg-obs').value.trim() || null,
    };
    try {
      if (p) await supabase.from('pagamentos').update(payload).eq('id', p.id);
      else {
        // Obter aluno_id da matrícula
        const { data: matData } = await supabase.from('matriculas').select('aluno_id').eq('id', matricula_id).single();
        payload.aluno_id = matData.aluno_id;
        await supabase.from('pagamentos').insert(payload);
      }
      mostrarToast('Pagamento salvo!', 'success');
      fechar(); carregar(); carregarStats(); carregarGraficoMensal();
    } catch(e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
}

const fmtData = d => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ── WhatsApp Cobrança ──────────────────────────────────────
window._wppCobranca = async id => {
  const { data: p } = await supabase.from('pagamentos')
    .select('*, alunos(nome,whatsapp,telefone), matriculas(*, cursos(nome)), empresas(nome_fantasia,responsavel_telefone,responsavel_nome)')
    .eq('id', id).single();
  if (!p) return;

  const { abrirModalWhatsApp } = await import('../js/whatsapp.js');
  const { getConfig } = await import('../js/supabase.js');
  const nomeEscola = await getConfig('nome_escola', 'TrainOS');
  const venc = p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-BR') : '—';
  const valor = Number(p.valor_cobrado).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  if (p.empresa_id && p.empresas) {
    abrirModalWhatsApp('cobranca_empresa', {
      nomeResponsavel: p.empresas.responsavel_nome || p.empresas.nome_fantasia,
      nomeEmpresa: p.empresas.nome_fantasia,
      qtdAlunos: '—',
      valor, dataVencimento: venc,
      numeroRecibo: p.numero_recibo || '—', nomeEscola,
    }, p.empresas.responsavel_telefone || '');
  } else {
    abrirModalWhatsApp('cobranca_aluno', {
      nomeAluno: p.alunos?.nome || '—',
      nomeCurso: p.matriculas?.cursos?.nome || '—',
      valor, dataVencimento: venc,
      numeroRecibo: p.numero_recibo || '—', nomeEscola,
    }, p.alunos?.whatsapp || p.alunos?.telefone || '');
  }
};
