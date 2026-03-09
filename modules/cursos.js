import { supabase, mostrarToast } from '../js/app.js';
import { debounce, emptyState, renderStatCards, renderPaginacao, delegarAcoes, confirmar, escapeHtml, traduzirErro } from '../js/utils.js';
let state = { pagina: 1, busca: '' };
const PAGE_SIZE = 20;
export async function renderCursos() {
  document.getElementById('topbar-title').textContent = 'Cursos';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header"><div class="page-header-left"><h1>CURSOS</h1><p>Catálogo de treinamentos e NRs</p></div>
      <div class="page-header-actions"><button class="btn btn-primary" id="btn-novo-curso"><span class="material-symbols-rounded">add</span> Novo Curso</button></div></div>
    <div class="stats-grid" id="stats-cursos"></div>
    <div class="table-container">
      <div class="table-toolbar"><div class="table-search"><input type="text" id="busca-curso" placeholder="Buscar curso, código ou NR..."/></div></div>
      <div id="tabela-cursos-wrap"></div>
      <div class="table-footer"><span id="info-cursos" class="text-muted text-sm"></span><div class="pagination" id="pag-cursos"></div></div>
    </div>`;
  document.getElementById('btn-novo-curso').addEventListener('click', () => abrirModal());
  document.getElementById('busca-curso').addEventListener('input', debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }));
  delegarAcoes(document.getElementById('tabela-cursos-wrap'), {
    'editar': id => editarCurso(id),
    'deletar': (id, nome) => deletarCurso(id, nome),
  });
  await Promise.all([carregar(), carregarStats()]);
}
async function carregarStats() {
  const [total, comValidade, semValidade] = await Promise.all([
    supabase.from('cursos').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('cursos').select('*', { count: 'exact', head: true }).not('validade_meses', 'is', null).eq('ativo', true),
    supabase.from('cursos').select('*', { count: 'exact', head: true }).is('validade_meses', null).eq('ativo', true),
  ]);
  renderStatCards('stats-cursos', [
    { icon: 'menu_book', label: 'Cursos Ativos', value: total.count??0, cor: 'var(--accent)' },
    { icon: 'update', label: 'Com Validade', value: comValidade.count??0, cor: 'var(--warning)' },
    { icon: 'all_inclusive', label: 'Sem Validade', value: semValidade.count??0, cor: 'var(--success)' },
  ]);
}
async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('cursos').select('*', { count: 'exact' }).eq('ativo', true).order('nome').range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`nome.ilike.%${state.busca}%,codigo.ilike.%${state.busca}%,norma_regulamentadora.ilike.%${state.busca}%`);
  const { data, error, count } = await q;
  if (error) { mostrarToast(traduzirErro(error), 'error'); return; }
  renderTabela(data);
  renderPaginacao({ containerId: 'pag-cursos', infoId: 'info-cursos', pagina: state.pagina, total: count, pageSize: PAGE_SIZE, label: 'cursos', onPage: p => { state.pagina = p; carregar(); } });
}
function renderTabela(rows) {
  const wrap = document.getElementById('tabela-cursos-wrap');
  if (!rows?.length) { wrap.innerHTML = emptyState('menu_book', 'Nenhum curso cadastrado'); return; }
  wrap.innerHTML = `<table><thead><tr><th>Código</th><th>Nome</th><th>NR</th><th>Carga H.</th><th>Validade</th><th>Valor</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(c => `<tr>
      <td class="mono text-sm">${escapeHtml(c.codigo)}</td>
      <td><strong>${escapeHtml(c.nome)}</strong></td>
      <td>${c.norma_regulamentadora?`<span class="badge badge-info">${escapeHtml(c.norma_regulamentadora)}</span>`:'—'}</td>
      <td>${c.carga_horaria_horas}h</td>
      <td>${c.validade_meses?`<span class="badge badge-warning">${c.validade_meses} meses</span>`:'<span class="badge badge-neutral">Sem validade</span>'}</td>
      <td class="mono">R$ ${Number(c.valor_padrao).toFixed(2)}</td>
      <td><div class="flex gap-2">
        <button class="btn-icon" data-action="editar" data-id="${c.id}"><span class="material-symbols-rounded">edit</span></button>
        <button class="btn-icon" data-action="deletar" data-id="${c.id}" data-extra="${escapeHtml(c.nome)}"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}
function abrirModal(c = null) {
  const v = c || {};
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${c?'Editar Curso':'Novo Curso'}</h2>
      <button class="btn-icon" id="fc-c"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Nome *</label><input id="c-nome" value="${escapeHtml(v.nome||'')}" placeholder="Ex: Operador de Empilhadeira"/></div>
      <div class="form-group"><label>Código *</label><input id="c-cod" value="${escapeHtml(v.codigo||'')}" placeholder="EMP-01"/></div>
      <div class="form-group"><label>NR</label><input id="c-nr" value="${escapeHtml(v.norma_regulamentadora||'')}" placeholder="NR11"/></div>
      <div class="form-group"><label>Categoria</label><input id="c-cat" value="${escapeHtml(v.categoria||'')}" placeholder="Ex: Segurança, Operação"/></div>
      <div class="form-group"><label>Modalidade</label><select id="c-modal">
        <option value="presencial" ${v.modalidade==='presencial'||!v.modalidade?'selected':''}>Presencial</option>
        <option value="ead" ${v.modalidade==='ead'?'selected':''}>EAD</option>
        <option value="hibrido" ${v.modalidade==='hibrido'?'selected':''}>Híbrido</option>
      </select></div>
      <div class="form-group"><label>Carga Horária *</label><input type="number" id="c-ch" value="${v.carga_horaria_horas||''}" min="1"/></div>
      <div class="form-group"><label>Validade (meses)</label><input type="number" id="c-val" value="${v.validade_meses||''}" placeholder="Vazio = sem validade" min="1"/></div>
      <div class="form-group"><label>Valor Padrão (R$)</label><input type="number" id="c-valor" value="${v.valor_padrao||0}" min="0" step="0.01"/></div>
      <div class="form-group full"><label>Descrição</label><textarea id="c-desc">${escapeHtml(v.descricao||'')}</textarea></div>
      <div class="form-group full"><label>Conteúdo Programático</label><textarea id="c-prog">${escapeHtml(v.conteudo_programatico||'')}</textarea></div>
      <div class="form-group full"><label>Pré-requisitos</label><textarea id="c-req">${escapeHtml(v.requisitos||'')}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-c2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-curso"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-c').addEventListener('click', fechar);
  backdrop.querySelector('#fc-c2').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  backdrop.querySelector('#salvar-curso').addEventListener('click', async () => {
    const nome = backdrop.querySelector('#c-nome').value.trim();
    const codigo = backdrop.querySelector('#c-cod').value.trim();
    const carga = parseFloat(backdrop.querySelector('#c-ch').value);
    if (!nome || !codigo || isNaN(carga)) { mostrarToast('Preencha nome, código e carga horária', 'warning'); return; }
    const payload = {
      nome, codigo, carga_horaria_horas: carga,
      norma_regulamentadora: backdrop.querySelector('#c-nr').value.trim() || null,
      categoria: backdrop.querySelector('#c-cat').value.trim() || null,
      modalidade: backdrop.querySelector('#c-modal').value || null,
      validade_meses: parseInt(backdrop.querySelector('#c-val').value) || null,
      valor_padrao: parseFloat(backdrop.querySelector('#c-valor').value) || 0,
      descricao: backdrop.querySelector('#c-desc').value.trim() || null,
      conteudo_programatico: backdrop.querySelector('#c-prog').value.trim() || null,
      requisitos: backdrop.querySelector('#c-req').value.trim() || null,
    };
    try {
      if (c) await supabase.from('cursos').update(payload).eq('id', c.id);
      else await supabase.from('cursos').insert(payload);
      mostrarToast(c ? 'Curso atualizado!' : 'Curso criado!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });
}
async function editarCurso(id) { const { data } = await supabase.from('cursos').select('*').eq('id', id).single(); abrirModal(data); }
async function deletarCurso(id, nome) {
  const ok = await confirmar(`Desativar curso <strong>${escapeHtml(nome)}</strong>?`);
  if (!ok) return;
  try { await supabase.from('cursos').update({ ativo: false }).eq('id', id); mostrarToast('Removido', 'success'); carregar(); carregarStats(); }
  catch (e) { mostrarToast(traduzirErro(e), 'error'); }
}
