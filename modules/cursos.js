// modules/cursos.js — CRUD completo de Cursos
import { supabase, mostrarToast } from '../js/app.js';

let state = { pagina: 1, busca: '' };
const PAGE_SIZE = 20;

export async function renderCursos() {
  document.getElementById('topbar-title').textContent = 'Cursos';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>CURSOS</h1><p>Catálogo de treinamentos e NRs</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-novo-curso"><span class="material-symbols-rounded">add</span> Novo Curso</button>
      </div>
    </div>
    <div class="stats-grid" id="stats-cursos"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-curso" placeholder="Buscar curso, código ou NR..." /></div>
      </div>
      <div id="tabela-cursos-wrap"></div>
      <div class="table-footer">
        <span id="info-cursos" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-cursos"></div>
      </div>
    </div>`;

  document.getElementById('btn-novo-curso').onclick = () => abrirModal();
  document.getElementById('busca-curso').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  await Promise.all([carregar(), carregarStats()]);
}

async function carregarStats() {
  const { count: total } = await supabase.from('cursos').select('*', { count: 'exact', head: true }).eq('ativo', true);
  const { count: comValidade } = await supabase.from('cursos').select('*', { count: 'exact', head: true }).not('validade_meses', 'is', null).eq('ativo', true);
  document.getElementById('stats-cursos').innerHTML = [
    { icon: 'menu_book', label: 'Cursos Ativos', value: total ?? 0, cor: 'var(--accent)' },
    { icon: 'update', label: 'Com Validade', value: comValidade ?? 0, cor: 'var(--warning)' },
  ].map(s => `<div class="stat-card"><div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('cursos').select('*', { count: 'exact' }).eq('ativo', true).order('nome').range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`nome.ilike.%${state.busca}%,codigo.ilike.%${state.busca}%,norma_regulamentadora.ilike.%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast('Erro', 'error'); return; }
  renderTabela(data);
  document.getElementById('info-cursos').textContent = `${count} cursos`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-cursos').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgCurso(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgCurso(${state.pagina + 1})">›</button>`;
  window._pgCurso = p => { state.pagina = p; carregar(); };
}

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-cursos-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">menu_book</span><p>Nenhum curso cadastrado</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Código</th><th>Nome</th><th>NR</th><th>Carga H.</th><th>Validade</th><th>Valor Padrão</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(c => `<tr>
      <td class="mono text-sm">${c.codigo}</td>
      <td><strong>${c.nome}</strong></td>
      <td>${c.norma_regulamentadora ? `<span class="badge badge-info">${c.norma_regulamentadora}</span>` : '—'}</td>
      <td>${c.carga_horaria_horas}h</td>
      <td>${c.validade_meses ? `<span class="badge badge-warning">${c.validade_meses} meses</span>` : '<span class="badge badge-neutral">Sem validade</span>'}</td>
      <td class="mono">R$ ${Number(c.valor_padrao).toFixed(2)}</td>
      <td><div class="flex gap-2">
        <button class="btn-icon" onclick="window._editCurso('${c.id}')"><span class="material-symbols-rounded">edit</span></button>
        <button class="btn-icon" onclick="window._delCurso('${c.id}','${c.nome}')"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

function abrirModal(c = null) {
  const v = c || {};
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${c ? 'Editar Curso' : 'Novo Curso'}</h2>
      <button class="btn-icon" id="fc-c"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Nome do Curso *</label><input id="c-nome" value="${v.nome || ''}" placeholder="Ex: Operador de Empilhadeira" /></div>
      <div class="form-group"><label>Código *</label><input id="c-cod" value="${v.codigo || ''}" placeholder="Ex: EMP-01" /></div>
      <div class="form-group"><label>Norma Regulamentadora</label><input id="c-nr" value="${v.norma_regulamentadora || ''}" placeholder="Ex: NR11" /></div>
      <div class="form-group"><label>Carga Horária (horas) *</label><input type="number" id="c-ch" value="${v.carga_horaria_horas || ''}" min="1" /></div>
      <div class="form-group"><label>Validade (meses)</label><input type="number" id="c-val" value="${v.validade_meses || ''}" placeholder="Deixe vazio = sem validade" min="1" /></div>
      <div class="form-group"><label>Valor Padrão (R$)</label><input type="number" id="c-valor" value="${v.valor_padrao || 0}" min="0" step="0.01" /></div>
      <div class="form-group full"><label>Descrição</label><textarea id="c-desc">${v.descricao || ''}</textarea></div>
      <div class="form-group full"><label>Conteúdo Programático</label><textarea id="c-prog">${v.conteudo_programatico || ''}</textarea></div>
      <div class="form-group full"><label>Pré-requisitos</label><textarea id="c-req">${v.requisitos || ''}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-c2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-curso"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-c').onclick = fechar;
  document.getElementById('fc-c2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.getElementById('salvar-curso').onclick = async () => {
    const nome = document.getElementById('c-nome').value.trim();
    const codigo = document.getElementById('c-cod').value.trim();
    const carga = parseFloat(document.getElementById('c-ch').value);
    if (!nome || !codigo || isNaN(carga)) { mostrarToast('Preencha nome, código e carga horária', 'warning'); return; }
    const payload = {
      nome, codigo, carga_horaria_horas: carga,
      norma_regulamentadora: document.getElementById('c-nr').value.trim() || null,
      validade_meses: parseInt(document.getElementById('c-val').value) || null,
      valor_padrao: parseFloat(document.getElementById('c-valor').value) || 0,
      descricao: document.getElementById('c-desc').value.trim() || null,
      conteudo_programatico: document.getElementById('c-prog').value.trim() || null,
      requisitos: document.getElementById('c-req').value.trim() || null,
    };
    try {
      if (c) await supabase.from('cursos').update(payload).eq('id', c.id);
      else await supabase.from('cursos').insert(payload);
      mostrarToast(c ? 'Curso atualizado!' : 'Curso criado!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
}

window._editCurso = async id => { const { data } = await supabase.from('cursos').select('*').eq('id', id).single(); abrirModal(data); };
window._delCurso = async (id, nome) => {
  if (!confirm(`Desativar curso "${nome}"?`)) return;
  await supabase.from('cursos').update({ ativo: false }).eq('id', id);
  mostrarToast('Curso removido', 'success'); carregar(); carregarStats();
};
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
