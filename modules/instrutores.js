// modules/instrutores.js — CRUD de Instrutores
import { supabase, mostrarToast } from '../js/app.js';
let state = { pagina: 1, busca: '' };
const PAGE_SIZE = 20;

export async function renderInstrutores() {
  document.getElementById('topbar-title').textContent = 'Instrutores';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>INSTRUTORES</h1><p>Gestão de corpo docente</p></div>
      <div class="page-header-actions"><button class="btn btn-primary" id="btn-novo-instr"><span class="material-symbols-rounded">person_add</span> Novo Instrutor</button></div>
    </div>
    <div class="stats-grid" id="stats-instrutores"></div>
    <div class="table-container">
      <div class="table-toolbar"><div class="table-search"><input type="text" id="busca-instr" placeholder="Buscar por nome ou especialidade..." /></div></div>
      <div id="tabela-instrutores-wrap"></div>
      <div class="table-footer"><span id="info-instrutores" class="text-muted text-sm"></span><div class="pagination" id="pag-instrutores"></div></div>
    </div>`;

  document.getElementById('btn-novo-instr').onclick = () => abrirModal();
  document.getElementById('busca-instr').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  await Promise.all([carregar(), carregarStats()]);
}

async function carregarStats() {
  const { count } = await supabase.from('instrutores').select('*', { count: 'exact', head: true }).eq('ativo', true);
  document.getElementById('stats-instrutores').innerHTML = `
    <div class="stat-card"><div class="stat-icon" style="color:var(--accent)"><span class="material-symbols-rounded">person_badge</span></div>
    <div class="stat-value">${count ?? 0}</div><div class="stat-label">Instrutores Ativos</div></div>`;
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('instrutores').select('*', { count: 'exact' }).eq('ativo', true).order('nome').range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.ilike('nome', `%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro', 'error'); return; }
  renderTabela(data);
  document.getElementById('info-instrutores').textContent = `${count} instrutores`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-instrutores').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgInstr(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgInstr(${state.pagina + 1})">›</button>`;
  window._pgInstr = p => { state.pagina = p; carregar(); };
}

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-instrutores-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">person_off</span><p>Nenhum instrutor cadastrado</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Nome</th><th>CPF</th><th>Contato</th><th>Especialidades</th><th>Registro Prof.</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(i => `<tr>
      <td><strong>${i.nome}</strong></td>
      <td class="mono text-sm">${i.cpf || '—'}</td>
      <td class="text-sm">${i.telefone || i.email || '—'}</td>
      <td>${(i.especialidades || []).map(e => `<span class="badge badge-info" style="margin:1px">${e}</span>`).join('') || '—'}</td>
      <td class="text-sm">${i.registro_profissional || '—'}</td>
      <td><div class="flex gap-2">
        <button class="btn-icon" onclick="window._editInstr('${i.id}')"><span class="material-symbols-rounded">edit</span></button>
        <button class="btn-icon" onclick="window._delInstr('${i.id}','${i.nome}')"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

function abrirModal(inst = null) {
  const v = inst || {};
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">
    <div class="modal-header"><h2>${inst ? 'Editar Instrutor' : 'Novo Instrutor'}</h2>
      <button class="btn-icon" id="fc-i"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Nome Completo *</label><input id="i-nome" value="${v.nome || ''}" /></div>
      <div class="form-group"><label>CPF</label><input id="i-cpf" value="${v.cpf || ''}" /></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="i-email" value="${v.email || ''}" /></div>
      <div class="form-group"><label>Telefone</label><input id="i-tel" value="${v.telefone || ''}" /></div>
      <div class="form-group"><label>Registro Profissional</label><input id="i-reg" value="${v.registro_profissional || ''}" /></div>
      <div class="form-group full"><label>Especialidades (separadas por vírgula)</label>
        <input id="i-esp" value="${(v.especialidades || []).join(', ')}" placeholder="Ex: NR35, Empilhadeira, Munck" />
      </div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-i2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-instr"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-i').onclick = fechar;
  document.getElementById('fc-i2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.getElementById('salvar-instr').onclick = async () => {
    const nome = document.getElementById('i-nome').value.trim();
    if (!nome) { mostrarToast('Nome obrigatório', 'warning'); return; }
    const espStr = document.getElementById('i-esp').value;
    const especialidades = espStr ? espStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const payload = {
      nome, cpf: document.getElementById('i-cpf').value.trim() || null,
      email: document.getElementById('i-email').value.trim() || null,
      telefone: document.getElementById('i-tel').value.trim() || null,
      registro_profissional: document.getElementById('i-reg').value.trim() || null,
      especialidades,
    };
    try {
      if (inst) await supabase.from('instrutores').update(payload).eq('id', inst.id);
      else await supabase.from('instrutores').insert(payload);
      mostrarToast(inst ? 'Instrutor atualizado!' : 'Instrutor cadastrado!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
}

window._editInstr = async id => { const { data } = await supabase.from('instrutores').select('*').eq('id', id).single(); abrirModal(data); };
window._delInstr = async (id, nome) => {
  if (!confirm(`Desativar "${nome}"?`)) return;
  await supabase.from('instrutores').update({ ativo: false }).eq('id', id);
  mostrarToast('Instrutor removido', 'success'); carregar(); carregarStats();
};
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
