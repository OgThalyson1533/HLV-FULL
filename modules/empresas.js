// modules/empresas.js — CRUD completo de Empresas
import { supabase, mostrarToast } from '../js/app.js';

let state = { pagina: 1, busca: '', total: 0 };
const PAGE_SIZE = 20;

export async function renderEmpresas() {
  document.getElementById('topbar-title').textContent = 'Empresas';
  const el = document.getElementById('main-content');
  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>EMPRESAS</h1><p>Clientes B2B e corporativos</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-nova-empresa">
          <span class="material-symbols-rounded">add_business</span> Nova Empresa
        </button>
      </div>
    </div>
    <div class="stats-grid" id="stats-empresas"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-empresa" placeholder="Buscar por razão social, CNPJ ou cidade..." /></div>
      </div>
      <div id="tabela-empresas-wrap"></div>
      <div class="table-footer">
        <span id="info-emp" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-emp"></div>
      </div>
    </div>`;

  document.getElementById('btn-nova-empresa').onclick = () => abrirModal();
  document.getElementById('busca-empresa').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  await Promise.all([carregar(), carregarStats()]);
}

async function carregarStats() {
  const { count: total } = await supabase.from('empresas').select('*', { count: 'exact', head: true }).eq('ativo', true);
  const { count: comAlunos } = await supabase.from('alunos').select('empresa_id', { count: 'exact', head: true }).not('empresa_id', 'is', null);
  document.getElementById('stats-empresas').innerHTML = [
    { icon: 'business', label: 'Empresas Ativas', value: total ?? 0, cor: 'var(--accent)' },
    { icon: 'group', label: 'Alunos Vinculados', value: comAlunos ?? 0, cor: 'var(--info)' },
  ].map(s => `<div class="stat-card"><div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('empresas').select('*', { count: 'exact' }).eq('ativo', true).order('razao_social').range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`razao_social.ilike.%${state.busca}%,cnpj.ilike.%${state.busca}%,cidade.ilike.%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro ao carregar empresas', 'error'); return; }
  state.total = count;
  renderTabela(data);
  document.getElementById('info-emp').textContent = `${count} empresas`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-emp').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgEmp(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgEmp(${state.pagina + 1})">›</button>`;
  window._pgEmp = p => { state.pagina = p; carregar(); };
}

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-empresas-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">business_center</span><p>Nenhuma empresa cadastrada</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Razão Social</th><th>Nome Fantasia</th><th>CNPJ</th><th>Responsável</th><th>Cidade/UF</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(e => `<tr>
      <td><strong>${e.razao_social}</strong></td>
      <td class="text-muted">${e.nome_fantasia || '—'}</td>
      <td class="mono text-sm">${e.cnpj || '—'}</td>
      <td class="text-sm">${e.responsavel_nome || '—'}<br><span class="text-muted">${e.responsavel_telefone || ''}</span></td>
      <td class="text-sm">${e.cidade || '—'}${e.estado ? '/' + e.estado : ''}</td>
      <td><div class="flex gap-2">
        <button class="btn-icon" onclick="window._editEmp('${e.id}')"><span class="material-symbols-rounded">edit</span></button>
        <button class="btn-icon" onclick="window._delEmp('${e.id}','${e.razao_social}')"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

function abrirModal(emp = null) {
  const v = emp || {};
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${emp ? 'Editar Empresa' : 'Nova Empresa'}</h2>
      <button class="btn-icon" id="fc-emp"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Razão Social *</label><input id="e-rs" value="${v.razao_social || ''}" /></div>
      <div class="form-group"><label>Nome Fantasia</label><input id="e-nf" value="${v.nome_fantasia || ''}" /></div>
      <div class="form-group"><label>CNPJ</label><input id="e-cnpj" value="${v.cnpj || ''}" /></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="e-email" value="${v.email || ''}" /></div>
      <div class="form-group"><label>Telefone</label><input id="e-tel" value="${v.telefone || ''}" /></div>
      <div class="form-group"><label>Responsável</label><input id="e-resp" value="${v.responsavel_nome || ''}" /></div>
      <div class="form-group"><label>Tel. Responsável</label><input id="e-rtel" value="${v.responsavel_telefone || ''}" /></div>
      <div class="form-group"><label>E-mail Responsável</label><input id="e-remail" value="${v.responsavel_email || ''}" /></div>
      <div class="form-group full"><label>Endereço</label><input id="e-end" value="${v.endereco || ''}" /></div>
      <div class="form-group"><label>Cidade</label><input id="e-cidade" value="${v.cidade || ''}" /></div>
      <div class="form-group"><label>Estado</label><input id="e-estado" value="${v.estado || ''}" maxlength="2" /></div>
      <div class="form-group"><label>CEP</label><input id="e-cep" value="${v.cep || ''}" /></div>
      <div class="form-group full"><label>Observações</label><textarea id="e-obs">${v.observacoes || ''}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-emp2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-emp"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-emp').onclick = fechar;
  document.getElementById('fc-emp2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.getElementById('salvar-emp').onclick = async () => {
    const razao_social = document.getElementById('e-rs').value.trim();
    if (!razao_social) { mostrarToast('Razão social obrigatória', 'warning'); return; }
    const payload = {
      razao_social, nome_fantasia: document.getElementById('e-nf').value.trim() || null,
      cnpj: document.getElementById('e-cnpj').value.trim() || null,
      email: document.getElementById('e-email').value.trim() || null,
      telefone: document.getElementById('e-tel').value.trim() || null,
      responsavel_nome: document.getElementById('e-resp').value.trim() || null,
      responsavel_telefone: document.getElementById('e-rtel').value.trim() || null,
      responsavel_email: document.getElementById('e-remail').value.trim() || null,
      endereco: document.getElementById('e-end').value.trim() || null,
      cidade: document.getElementById('e-cidade').value.trim() || null,
      estado: document.getElementById('e-estado').value.trim() || null,
      cep: document.getElementById('e-cep').value.trim() || null,
      observacoes: document.getElementById('e-obs').value.trim() || null,
    };
    try {
      if (emp) await supabase.from('empresas').update(payload).eq('id', emp.id);
      else await supabase.from('empresas').insert(payload);
      mostrarToast(emp ? 'Empresa atualizada!' : 'Empresa cadastrada!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
}

window._editEmp = async id => { const { data } = await supabase.from('empresas').select('*').eq('id', id).single(); abrirModal(data); };
window._delEmp = async (id, nome) => {
  if (!confirm(`Desativar "${nome}"?`)) return;
  await supabase.from('empresas').update({ ativo: false }).eq('id', id);
  mostrarToast('Empresa removida', 'success'); carregar(); carregarStats();
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
