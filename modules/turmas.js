// modules/turmas.js — CRUD completo de Turmas
import { supabase, mostrarToast } from '../js/app.js';

let state = { pagina: 1, busca: '', filtroStatus: '', cursos: [], instrutores: [] };
const PAGE_SIZE = 20;

export async function renderTurmas() {
  document.getElementById('topbar-title').textContent = 'Turmas';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>TURMAS</h1><p>Agendamento e controle de turmas</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-nova-turma"><span class="material-symbols-rounded">add</span> Nova Turma</button>
      </div>
    </div>
    <div class="stats-grid" id="stats-turmas"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-turma" placeholder="Buscar por código, curso..." /></div>
        <select id="filtro-status-turma" style="width:160px">
          <option value="">Todos os status</option>
          <option value="agendada">Agendada</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>
      <div id="tabela-turmas-wrap"></div>
      <div class="table-footer">
        <span id="info-turmas" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-turmas"></div>
      </div>
    </div>`;

  document.getElementById('btn-nova-turma').onclick = () => abrirModal();
  document.getElementById('busca-turma').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  document.getElementById('filtro-status-turma').onchange = e => { state.filtroStatus = e.target.value; state.pagina = 1; carregar(); };
  await Promise.all([carregarCursos(), carregarInstrutores(), carregar(), carregarStats()]);
}

async function carregarStats() {
  const [ag, ea, con, can] = await Promise.all([
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'agendada'),
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'concluida'),
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'cancelada'),
  ]);
  document.getElementById('stats-turmas').innerHTML = [
    { icon: 'event', label: 'Agendadas', value: ag.count ?? 0, cor: 'var(--info)' },
    { icon: 'play_circle', label: 'Em Andamento', value: ea.count ?? 0, cor: 'var(--accent)' },
    { icon: 'check_circle', label: 'Concluídas', value: con.count ?? 0, cor: 'var(--success)' },
    { icon: 'cancel', label: 'Canceladas', value: can.count ?? 0, cor: 'var(--danger)' },
  ].map(s => `<div class="stat-card"><div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
}

async function carregarCursos() { const { data } = await supabase.from('cursos').select('id,nome,codigo').eq('ativo', true).order('nome'); state.cursos = data || []; }
async function carregarInstrutores() { const { data } = await supabase.from('instrutores').select('id,nome').eq('ativo', true).order('nome'); state.instrutores = data || []; }

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('turmas').select('*, cursos(nome,codigo), instrutores(nome)', { count: 'exact' }).order('data_inicio', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`codigo.ilike.%${state.busca}%`);
  if (state.filtroStatus) q = q.eq('status', state.filtroStatus);
  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro', 'error'); return; }
  renderTabela(data);
  document.getElementById('info-turmas').textContent = `${count} turmas`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-turmas').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgTurma(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgTurma(${state.pagina + 1})">›</button>`;
  window._pgTurma = p => { state.pagina = p; carregar(); };
}

const statusCores = { agendada: 'badge-info', em_andamento: 'badge-warning', concluida: 'badge-success', cancelada: 'badge-neutral' };
const statusLabels = { agendada: 'Agendada', em_andamento: 'Em Andamento', concluida: 'Concluída', cancelada: 'Cancelada' };

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-turmas-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">calendar_month</span><p>Nenhuma turma encontrada</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Código</th><th>Curso</th><th>Instrutor</th><th>Início</th><th>Fim</th><th>Vagas</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(t => {
      const vagas = t.vagas_disponiveis;
      const vagaCor = vagas === 0 ? 'var(--danger)' : vagas <= 3 ? 'var(--warning)' : 'var(--success)';
      return `<tr>
        <td class="mono text-sm">${t.codigo}</td>
        <td><strong>${t.cursos?.nome || '—'}</strong><br><span class="text-muted text-xs">${t.cursos?.codigo || ''}</span></td>
        <td class="text-sm">${t.instrutores?.nome || '—'}</td>
        <td class="text-sm">${fmtData(t.data_inicio)}</td>
        <td class="text-sm">${fmtData(t.data_fim)}</td>
        <td><span style="color:${vagaCor}" class="mono">${vagas}/${t.vagas_total}</span></td>
        <td><span class="badge ${statusCores[t.status] || 'badge-neutral'}">${statusLabels[t.status] || t.status}</span></td>
        <td><div class="flex gap-2">
          <button class="btn-icon" onclick="window._editTurma('${t.id}')"><span class="material-symbols-rounded">edit</span></button>
          <button class="btn-icon" onclick="window._delTurma('${t.id}','${t.codigo}')"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function abrirModal(t = null) {
  const v = t || {};
  const cursosOpts = state.cursos.map(c => `<option value="${c.id}" ${v.curso_id === c.id ? 'selected' : ''}>${c.nome} (${c.codigo})</option>`).join('');
  const instrOpts = state.instrutores.map(i => `<option value="${i.id}" ${v.instrutor_id === i.id ? 'selected' : ''}>${i.nome}</option>`).join('');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${t ? 'Editar Turma' : 'Nova Turma'}</h2>
      <button class="btn-icon" id="fc-t"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group"><label>Código *</label><input id="t-cod" value="${v.codigo || ''}" placeholder="TUR-2025-01" /></div>
      <div class="form-group"><label>Curso *</label><select id="t-curso"><option value="">Selecione...</option>${cursosOpts}</select></div>
      <div class="form-group"><label>Instrutor</label><select id="t-instr"><option value="">— nenhum —</option>${instrOpts}</select></div>
      <div class="form-group"><label>Status</label><select id="t-status">
        <option value="agendada" ${v.status === 'agendada' ? 'selected' : ''}>Agendada</option>
        <option value="em_andamento" ${v.status === 'em_andamento' ? 'selected' : ''}>Em Andamento</option>
        <option value="concluida" ${v.status === 'concluida' ? 'selected' : ''}>Concluída</option>
        <option value="cancelada" ${v.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
      </select></div>
      <div class="form-group"><label>Data Início *</label><input type="date" id="t-ini" value="${v.data_inicio || ''}" /></div>
      <div class="form-group"><label>Data Fim *</label><input type="date" id="t-fim" value="${v.data_fim || ''}" /></div>
      <div class="form-group"><label>Horário Início</label><input type="time" id="t-hi" value="${v.horario_inicio || ''}" /></div>
      <div class="form-group"><label>Horário Fim</label><input type="time" id="t-hf" value="${v.horario_fim || ''}" /></div>
      <div class="form-group"><label>Local</label><input id="t-local" value="${v.local || ''}" /></div>
      <div class="form-group"><label>Total de Vagas</label><input type="number" id="t-vagas" value="${v.vagas_total || 20}" min="1" /></div>
      <div class="form-group full"><label>Observações</label><textarea id="t-obs">${v.observacoes || ''}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-t2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-turma"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-t').onclick = fechar;
  document.getElementById('fc-t2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.getElementById('salvar-turma').onclick = async () => {
    const codigo = document.getElementById('t-cod').value.trim();
    const curso_id = document.getElementById('t-curso').value;
    const data_inicio = document.getElementById('t-ini').value;
    const data_fim = document.getElementById('t-fim').value;
    if (!codigo || !curso_id || !data_inicio || !data_fim) { mostrarToast('Preencha campos obrigatórios', 'warning'); return; }
    const vagas_total = parseInt(document.getElementById('t-vagas').value) || 20;
    const payload = {
      codigo, curso_id, data_inicio, data_fim, vagas_total,
      instrutor_id: document.getElementById('t-instr').value || null,
      status: document.getElementById('t-status').value,
      horario_inicio: document.getElementById('t-hi').value || null,
      horario_fim: document.getElementById('t-hf').value || null,
      local: document.getElementById('t-local').value.trim() || null,
      observacoes: document.getElementById('t-obs').value.trim() || null,
      ...(t ? {} : { vagas_disponiveis: vagas_total }),
    };
    try {
      if (t) await supabase.from('turmas').update(payload).eq('id', t.id);
      else await supabase.from('turmas').insert(payload);
      mostrarToast(t ? 'Turma atualizada!' : 'Turma criada!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
}

window._editTurma = async id => { const { data } = await supabase.from('turmas').select('*').eq('id', id).single(); await carregarCursos(); await carregarInstrutores(); abrirModal(data); };
window._delTurma = async (id, cod) => {
  if (!confirm(`Cancelar turma "${cod}"?`)) return;
  await supabase.from('turmas').update({ status: 'cancelada' }).eq('id', id);
  mostrarToast('Turma cancelada', 'success'); carregar(); carregarStats();
};
const fmtData = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
