import { supabase, mostrarToast } from '../js/app.js';
import { debounce, emptyState, renderStatCards, renderPaginacao, delegarAcoes, confirmar, escapeHtml, traduzirErro } from '../js/utils.js';
let state = { pagina: 1, busca: '' };
const PAGE_SIZE = 20;
export async function renderInstrutores() {
  document.getElementById('topbar-title').textContent = 'Instrutores';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div class="page-header-left"><h1>INSTRUTORES</h1><p>Gestão do corpo docente</p></div>
      <div class="page-header-actions"><button class="btn btn-primary" id="btn-novo-instr"><span class="material-symbols-rounded">person_add</span> Novo Instrutor</button></div></div>
    <div class="stats-grid" id="stats-inst"></div>
    <div class="table-container">
      <div class="table-toolbar"><div class="table-search"><input type="text" id="busca-instr" placeholder="Buscar por nome ou especialidade..."/></div></div>
      <div id="tabela-inst-wrap"></div>
      <div class="table-footer"><span id="info-inst" class="text-muted text-sm"></span><div class="pagination" id="pag-inst"></div></div>
    </div>`;
  document.getElementById('btn-novo-instr').addEventListener('click', () => abrirModal());
  document.getElementById('busca-instr').addEventListener('input', debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }));
  delegarAcoes(document.getElementById('tabela-inst-wrap'), {
    'editar': id => editarInstrutor(id),
    'deletar': (id, nome) => deletarInstrutor(id, nome),
  });
  await Promise.all([carregar(), carregarStats()]);
}
async function carregarStats() {
  const { count } = await supabase.from('instrutores').select('*', { count: 'exact', head: true }).eq('ativo', true);
  const { count: turmasAtivas } = await supabase.from('turmas').select('instrutor_id', { count: 'exact', head: true }).in('status', ['agendada','em_andamento']);
  renderStatCards('stats-inst', [
    { icon: 'person_badge', label: 'Instrutores Ativos', value: count ?? 0, cor: 'var(--accent)' },
    { icon: 'calendar_month', label: 'Turmas Ativas', value: turmasAtivas ?? 0, cor: 'var(--info)' },
  ]);
}
async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('instrutores').select('*', { count: 'exact' }).eq('ativo', true).order('nome').range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.ilike('nome', `%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast(traduzirErro(error), 'error'); return; }
  renderTabela(data);
  renderPaginacao({ containerId: 'pag-inst', infoId: 'info-inst', pagina: state.pagina, total: count, pageSize: PAGE_SIZE, label: 'instrutores', onPage: p => { state.pagina = p; carregar(); } });
}
function renderTabela(rows) {
  const wrap = document.getElementById('tabela-inst-wrap');
  if (!rows?.length) { wrap.innerHTML = emptyState('person_off', 'Nenhum instrutor cadastrado'); return; }
  wrap.innerHTML = `<table><thead><tr><th>Nome</th><th>CPF</th><th>Contato</th><th>Especialidades</th><th>Registro</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(i => `<tr>
      <td><strong>${escapeHtml(i.nome)}</strong></td>
      <td class="mono text-sm">${escapeHtml(i.cpf||'—')}</td>
      <td class="text-sm">${escapeHtml(i.telefone||i.email||'—')}</td>
      <td>${(i.especialidades||[]).map(e => `<span class="badge badge-info" style="margin:1px">${escapeHtml(e)}</span>`).join('')||'—'}</td>
      <td class="text-sm">${escapeHtml(i.registro_profissional||'—')}</td>
      <td><div class="flex gap-2">
        <button class="btn-icon" data-action="editar" data-id="${i.id}"><span class="material-symbols-rounded">edit</span></button>
        <button class="btn-icon" data-action="deletar" data-id="${i.id}" data-extra="${escapeHtml(i.nome)}"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}
function abrirModal(inst = null) {
  const v = inst || {};
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-header"><h2>${inst?'Editar Instrutor':'Novo Instrutor'}</h2>
      <button class="btn-icon" id="fc-i"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Nome Completo *</label><input id="i-nome" value="${escapeHtml(v.nome||'')}"/></div>
      <div class="form-group"><label>CPF</label><input id="i-cpf" value="${escapeHtml(v.cpf||'')}"/></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="i-email" value="${escapeHtml(v.email||'')}"/></div>
      <div class="form-group"><label>Telefone</label><input id="i-tel" value="${escapeHtml(v.telefone||'')}"/></div>
      <div class="form-group"><label>Registro Profissional</label><input id="i-reg" value="${escapeHtml(v.registro_profissional||'')}"/></div>
      <div class="form-group full"><label>Bio / Qualificações</label><textarea id="i-bio">${escapeHtml(v.bio||'')}</textarea></div>
      <div class="form-group full"><label>Especialidades (separadas por vírgula)</label>
        <input id="i-esp" value="${(v.especialidades||[]).map(s => escapeHtml(s)).join(', ')}" placeholder="Ex: NR35, Empilhadeira"/></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-i2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-inst"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-i').addEventListener('click', fechar);
  backdrop.querySelector('#fc-i2').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  backdrop.querySelector('#salvar-inst').addEventListener('click', async () => {
    const nome = backdrop.querySelector('#i-nome').value.trim();
    if (!nome) { mostrarToast('Nome obrigatório', 'warning'); return; }
    const espStr = backdrop.querySelector('#i-esp').value;
    const payload = {
      nome, cpf: backdrop.querySelector('#i-cpf').value.trim() || null,
      email: backdrop.querySelector('#i-email').value.trim() || null,
      telefone: backdrop.querySelector('#i-tel').value.trim() || null,
      registro_profissional: backdrop.querySelector('#i-reg').value.trim() || null,
      bio: backdrop.querySelector('#i-bio').value.trim() || null,
      especialidades: espStr ? espStr.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    try {
      if (inst) await supabase.from('instrutores').update(payload).eq('id', inst.id);
      else await supabase.from('instrutores').insert(payload);
      mostrarToast(inst ? 'Atualizado!' : 'Cadastrado!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });
}
async function editarInstrutor(id) { const { data } = await supabase.from('instrutores').select('*').eq('id', id).single(); abrirModal(data); }
async function deletarInstrutor(id, nome) {
  const ok = await confirmar(`Desativar instrutor <strong>${escapeHtml(nome)}</strong>?`);
  if (!ok) return;
  try { await supabase.from('instrutores').update({ ativo: false }).eq('id', id); mostrarToast('Removido', 'success'); carregar(); carregarStats(); }
  catch (e) { mostrarToast(traduzirErro(e), 'error'); }
}
