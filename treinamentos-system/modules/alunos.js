// modules/alunos.js — CRUD completo de Alunos
import { supabase, mostrarToast } from '../js/app.js';

let state = { dados: [], total: 0, pagina: 1, busca: '', empresas: [] };
const PAGE_SIZE = 20;

export async function renderAlunos() {
  document.getElementById('topbar-title').textContent = 'Alunos';
  const el = document.getElementById('main-content');
  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>ALUNOS</h1>
        <p>Cadastro e gestão de alunos</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-novo-aluno">
          <span class="material-symbols-rounded">person_add</span> Novo Aluno
        </button>
      </div>
    </div>

    <div class="stats-grid" id="stats-alunos"></div>

    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search">
          <input type="text" id="busca-aluno" placeholder="Buscar por nome, CPF ou e-mail..." />
        </div>
        <select id="filtro-tipo" style="width:160px">
          <option value="">Todos os tipos</option>
          <option value="pessoa_fisica">Pessoa Física</option>
          <option value="empresa">Empresa</option>
        </select>
      </div>
      <div id="tabela-alunos-wrap"></div>
      <div class="table-footer">
        <span id="info-paginacao-alunos" class="text-muted text-sm"></span>
        <div class="pagination" id="paginacao-alunos"></div>
      </div>
    </div>`;

  document.getElementById('btn-novo-aluno').onclick = () => abrirModal();
  document.getElementById('busca-aluno').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  document.getElementById('filtro-tipo').onchange = e => { state.filtroTipo = e.target.value; state.pagina = 1; carregar(); };

  await Promise.all([carregarEmpresas(), carregar(), carregarStats()]);
}

async function carregarStats() {
  const { count: total } = await supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('ativo', true);
  const { count: pf } = await supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('tipo_cliente', 'pessoa_fisica').eq('ativo', true);
  const { count: emp } = await supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('tipo_cliente', 'empresa').eq('ativo', true);
  const { count: novos } = await supabase.from('alunos').select('*', { count: 'exact', head: true })
    .gte('criado_em', new Date(Date.now() - 30 * 86400000).toISOString());

  document.getElementById('stats-alunos').innerHTML = [
    { icon: 'group', label: 'Total Ativos', value: total ?? 0, cor: 'var(--accent)' },
    { icon: 'person', label: 'Pessoa Física', value: pf ?? 0, cor: 'var(--info)' },
    { icon: 'business', label: 'Via Empresa', value: emp ?? 0, cor: 'var(--warning)' },
    { icon: 'person_add', label: 'Novos (30d)', value: novos ?? 0, cor: 'var(--success)' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

async function carregarEmpresas() {
  const { data } = await supabase.from('empresas').select('id, nome_fantasia, razao_social').eq('ativo', true).order('nome_fantasia');
  state.empresas = data || [];
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('alunos')
    .select('*, empresas(nome_fantasia)', { count: 'exact' })
    .eq('ativo', true)
    .order('nome')
    .range(from, from + PAGE_SIZE - 1);

  if (state.busca) {
    q = q.or(`nome.ilike.%${state.busca}%,cpf.ilike.%${state.busca}%,email.ilike.%${state.busca}%`);
  }
  if (state.filtroTipo) q = q.eq('tipo_cliente', state.filtroTipo);

  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro ao carregar alunos', 'error'); return; }

  state.dados = data; state.total = count;
  renderTabela(data);
  renderPaginacao(count);
}

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-alunos-wrap');
  if (!rows?.length) {
    wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">group_off</span><p>Nenhum aluno encontrado</p></div>`;
    return;
  }
  wrap.innerHTML = `<table>
    <thead><tr>
      <th>Nome</th><th>CPF</th><th>Contato</th><th>Empresa</th><th>Tipo</th><th>Ações</th>
    </tr></thead>
    <tbody>${rows.map(a => `
      <tr>
        <td><strong>${a.nome}</strong></td>
        <td class="mono text-sm">${a.cpf || '—'}</td>
        <td class="text-sm">${a.whatsapp || a.telefone || a.email || '—'}</td>
        <td class="text-sm text-muted">${a.empresas?.nome_fantasia || '—'}</td>
        <td><span class="badge ${a.tipo_cliente === 'empresa' ? 'badge-warning' : 'badge-info'}">${a.tipo_cliente === 'empresa' ? 'Empresa' : 'PF'}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn-icon" title="Editar" onclick="window._editAluno('${a.id}')"><span class="material-symbols-rounded">edit</span></button>
            <button class="btn-icon" title="Excluir" onclick="window._delAluno('${a.id}','${a.nome}')"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}

function renderPaginacao(total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  document.getElementById('info-paginacao-alunos').textContent = `${total} alunos encontrados`;
  const pg = document.getElementById('paginacao-alunos');
  pg.innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgAluno(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgAluno(${state.pagina + 1})">›</button>`;
  window._pgAluno = p => { state.pagina = p; carregar(); };
}

// ── Modal ──────────────────────────────────────────────────
function abrirModal(aluno = null) {
  const emp = state.empresas.map(e => `<option value="${e.id}" ${aluno?.empresa_id === e.id ? 'selected' : ''}>${e.nome_fantasia || e.razao_social}</option>`).join('');
  const v = aluno || {};
  const titulo = aluno ? 'Editar Aluno' : 'Novo Aluno';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h2>${titulo}</h2>
        <button class="btn-icon" id="fechar-modal-aluno"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group full"><label>Nome Completo *</label><input id="a-nome" value="${v.nome || ''}" placeholder="Nome completo" /></div>
          <div class="form-group"><label>CPF</label><input id="a-cpf" value="${v.cpf || ''}" placeholder="000.000.000-00" /></div>
          <div class="form-group"><label>RG</label><input id="a-rg" value="${v.rg || ''}" /></div>
          <div class="form-group"><label>Data de Nascimento</label><input type="date" id="a-nasc" value="${v.data_nascimento || ''}" /></div>
          <div class="form-group"><label>E-mail</label><input type="email" id="a-email" value="${v.email || ''}" /></div>
          <div class="form-group"><label>Telefone</label><input id="a-tel" value="${v.telefone || ''}" /></div>
          <div class="form-group"><label>WhatsApp</label><input id="a-wpp" value="${v.whatsapp || ''}" /></div>
          <div class="form-group"><label>Tipo</label>
            <select id="a-tipo">
              <option value="pessoa_fisica" ${v.tipo_cliente !== 'empresa' ? 'selected' : ''}>Pessoa Física</option>
              <option value="empresa" ${v.tipo_cliente === 'empresa' ? 'selected' : ''}>Empresa</option>
            </select>
          </div>
          <div class="form-group"><label>Empresa</label><select id="a-empresa"><option value="">— nenhuma —</option>${emp}</select></div>
          <div class="form-group"><label>Cargo</label><input id="a-cargo" value="${v.cargo || ''}" /></div>
          <div class="form-group"><label>Cidade</label><input id="a-cidade" value="${v.cidade || ''}" /></div>
          <div class="form-group"><label>Estado</label><input id="a-estado" value="${v.estado || ''}" maxlength="2" /></div>
          <div class="form-group full"><label>Observações</label><textarea id="a-obs">${v.observacoes || ''}</textarea></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="fechar-modal-aluno2">Cancelar</button>
        <button class="btn btn-primary" id="salvar-aluno">
          <span class="material-symbols-rounded">save</span> Salvar
        </button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fechar-modal-aluno').onclick = fechar;
  document.getElementById('fechar-modal-aluno2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });

  document.getElementById('salvar-aluno').onclick = async () => {
    const nome = document.getElementById('a-nome').value.trim();
    if (!nome) { mostrarToast('Nome é obrigatório', 'warning'); return; }

    const payload = {
      nome, cpf: document.getElementById('a-cpf').value.trim() || null,
      rg: document.getElementById('a-rg').value.trim() || null,
      data_nascimento: document.getElementById('a-nasc').value || null,
      email: document.getElementById('a-email').value.trim() || null,
      telefone: document.getElementById('a-tel').value.trim() || null,
      whatsapp: document.getElementById('a-wpp').value.trim() || null,
      tipo_cliente: document.getElementById('a-tipo').value,
      empresa_id: document.getElementById('a-empresa').value || null,
      cargo: document.getElementById('a-cargo').value.trim() || null,
      cidade: document.getElementById('a-cidade').value.trim() || null,
      estado: document.getElementById('a-estado').value.trim() || null,
      observacoes: document.getElementById('a-obs').value.trim() || null,
    };

    try {
      if (aluno) {
        await supabase.from('alunos').update(payload).eq('id', aluno.id);
        mostrarToast('Aluno atualizado!', 'success');
      } else {
        await supabase.from('alunos').insert(payload);
        mostrarToast('Aluno cadastrado!', 'success');
      }
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast('Erro ao salvar: ' + e.message, 'error'); }
  };
}

window._editAluno = async id => {
  const { data } = await supabase.from('alunos').select('*').eq('id', id).single();
  abrirModal(data);
};

window._delAluno = async (id, nome) => {
  if (!confirm(`Desativar aluno "${nome}"?`)) return;
  await supabase.from('alunos').update({ ativo: false }).eq('id', id);
  mostrarToast('Aluno removido', 'success'); carregar(); carregarStats();
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
