// modules/turmas.js v2 — com lista de alunos por turma e lista de espera
import { supabase, mostrarToast } from '../js/app.js';
import { fmtData, debounce, emptyState, renderStatCards, renderPaginacao, delegarAcoes, confirmar, escapeHtml, traduzirErro, skeletonTabela } from '../js/utils.js';

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
        <div class="table-search"><input type="text" id="busca-turma" placeholder="Buscar por código ou curso..."/></div>
        <select id="filtro-status-turma" style="width:160px">
          <option value="">Todos</option>
          <option value="agendada">Agendada</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>
      <div id="tabela-turmas-wrap">${skeletonTabela(8,5)}</div>
      <div class="table-footer">
        <span id="info-turmas" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-turmas"></div>
      </div>
    </div>`;

  document.getElementById('btn-nova-turma').addEventListener('click', () => abrirModal());
  document.getElementById('busca-turma').addEventListener('input', debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }));
  document.getElementById('filtro-status-turma').addEventListener('change', e => { state.filtroStatus = e.target.value; state.pagina = 1; carregar(); });

  delegarAcoes(document.getElementById('tabela-turmas-wrap'), {
    'editar': id => editarTurma(id),
    'alunos': id => abrirListaAlunos(id),
    'cancelar': (id, cod) => cancelarTurma(id, cod),
  });

  await Promise.all([carregarCursos(), carregarInstrutores(), carregar(), carregarStats()]);
}

async function carregarStats() {
  const [ag, ea, con, can] = await Promise.all([
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'agendada'),
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'concluida'),
    supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('status', 'cancelada'),
  ]);
  renderStatCards('stats-turmas', [
    { icon: 'event',        label: 'Agendadas',    value: ag.count ?? 0,  cor: 'var(--info)' },
    { icon: 'play_circle',  label: 'Em Andamento', value: ea.count ?? 0,  cor: 'var(--accent)' },
    { icon: 'check_circle', label: 'Concluídas',   value: con.count ?? 0, cor: 'var(--success)' },
    { icon: 'cancel',       label: 'Canceladas',   value: can.count ?? 0, cor: 'var(--danger)' },
  ]);
}

async function carregarCursos() { const { data } = await supabase.from('cursos').select('id,nome,codigo').eq('ativo', true).order('nome'); state.cursos = data || []; }
async function carregarInstrutores() { const { data } = await supabase.from('instrutores').select('id,nome').eq('ativo', true).order('nome'); state.instrutores = data || []; }

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('turmas').select('*, cursos(nome,codigo), instrutores(nome)', { count: 'exact' })
    .order('data_inicio', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`codigo.ilike.%${state.busca}%`);
  if (state.filtroStatus) q = q.eq('status', state.filtroStatus);
  const { data, error, count } = await q;
  if (error) { mostrarToast(traduzirErro(error), 'error'); return; }
  renderTabela(data);
  renderPaginacao({ containerId: 'pag-turmas', infoId: 'info-turmas', pagina: state.pagina, total: count, pageSize: PAGE_SIZE, label: 'turmas', onPage: p => { state.pagina = p; carregar(); } });
}

const statusCores = { agendada: 'badge-info', em_andamento: 'badge-warning', concluida: 'badge-success', cancelada: 'badge-neutral' };
const statusLabels = { agendada: 'Agendada', em_andamento: 'Em Andamento', concluida: 'Concluída', cancelada: 'Cancelada' };

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-turmas-wrap');
  if (!rows?.length) { wrap.innerHTML = emptyState('calendar_month', 'Nenhuma turma encontrada'); return; }
  wrap.innerHTML = `<table><thead><tr><th>Código</th><th>Curso</th><th>Instrutor</th><th>Início</th><th>Fim</th><th>Vagas</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(t => {
      const vagas = t.vagas_disponiveis;
      const vagaCor = vagas === 0 ? 'var(--danger)' : vagas <= 3 ? 'var(--warning)' : 'var(--success)';
      return `<tr>
        <td class="mono text-sm">${escapeHtml(t.codigo)}</td>
        <td><strong>${escapeHtml(t.cursos?.nome||'—')}</strong><br><span class="text-muted text-xs">${escapeHtml(t.cursos?.codigo||'')}</span></td>
        <td class="text-sm">${escapeHtml(t.instrutores?.nome||'—')}</td>
        <td class="text-sm">${fmtData(t.data_inicio)}</td>
        <td class="text-sm">${fmtData(t.data_fim)}</td>
        <td><span style="color:${vagaCor}" class="mono">${vagas}/${t.vagas_total}</span></td>
        <td><span class="badge ${statusCores[t.status]||'badge-neutral'}">${statusLabels[t.status]||t.status}</span></td>
        <td><div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" data-action="alunos" data-id="${t.id}" title="Ver alunos">
            <span class="material-symbols-rounded" style="font-size:14px">group</span> Alunos
          </button>
          <button class="btn-icon" data-action="editar" data-id="${t.id}"><span class="material-symbols-rounded">edit</span></button>
          <button class="btn-icon" data-action="cancelar" data-id="${t.id}" data-extra="${escapeHtml(t.codigo)}"><span class="material-symbols-rounded" style="color:var(--danger)">cancel</span></button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// ── NOVA FUNCIONALIDADE: Lista de alunos por turma ─────────
async function abrirListaAlunos(turmaId) {
  const { data: turma } = await supabase.from('turmas').select('*, cursos(nome)').eq('id', turmaId).single();
  const { data: matriculas } = await supabase.from('matriculas')
    .select('*, alunos(nome,cpf,whatsapp,telefone,email)')
    .eq('turma_id', turmaId).order('alunos(nome)');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg" style="max-width:750px">
    <div class="modal-header">
      <h2><span class="material-symbols-rounded" style="vertical-align:middle;margin-right:8px">group</span>
        Turma ${escapeHtml(turma?.codigo||'')} — ${escapeHtml(turma?.cursos?.nome||'')}</h2>
      <button class="btn-icon" id="fc-al"><span class="material-symbols-rounded">close</span></button>
    </div>
    <div class="modal-body">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="text-sm text-muted">${fmtData(turma?.data_inicio)} → ${fmtData(turma?.data_fim)} · ${matriculas?.length||0} alunos</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="btn-imprimir-lista">
            <span class="material-symbols-rounded" style="font-size:14px">print</span> Imprimir Lista
          </button>
          <button class="btn btn-sm btn-secondary" id="btn-export-lista">
            <span class="material-symbols-rounded" style="font-size:14px">download</span> CSV
          </button>
        </div>
      </div>
      ${!matriculas?.length ? emptyState('person_off', 'Nenhum aluno nesta turma') : `
      <table id="tabela-lista-alunos">
        <thead><tr>
          <th>#</th><th>Nome</th><th>CPF</th><th>Contato</th><th>Status</th>
          <th>Nota</th><th>Freq.%</th><th>Ações</th>
        </tr></thead>
        <tbody>${matriculas.map((m, i) => `<tr data-mat-id="${m.id}">
          <td class="text-muted text-sm">${i+1}</td>
          <td><strong>${escapeHtml(m.alunos?.nome||'—')}</strong></td>
          <td class="mono text-sm">${escapeHtml(m.alunos?.cpf||'—')}</td>
          <td class="text-sm">${escapeHtml(m.alunos?.whatsapp||m.alunos?.telefone||m.alunos?.email||'—')}</td>
          <td><span class="status-badge status-${m.status}" style="font-size:10px">${m.status.replace(/_/g,' ')}</span></td>
          <td><input type="number" class="input-nota" value="${m.nota_final||''}" min="0" max="10" step="0.1" style="width:60px;padding:4px;background:var(--bg-overlay);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-primary);font-size:12px"/></td>
          <td><input type="number" class="input-freq" value="${m.frequencia_percent||''}" min="0" max="100" style="width:60px;padding:4px;background:var(--bg-overlay);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-primary);font-size:12px"/></td>
          <td>${m.alunos?.whatsapp ? `<a href="https://wa.me/55${m.alunos.whatsapp.replace(/\D/g,'')}" target="_blank" class="btn-icon"><span class="material-symbols-rounded" style="font-size:16px;color:#25d366">chat</span></a>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table>`}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-al2">Fechar</button>
      ${matriculas?.length ? `<button class="btn btn-primary" id="btn-salvar-notas"><span class="material-symbols-rounded">save</span> Salvar Notas/Frequências</button>` : ''}
    </div>
  </div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-al').addEventListener('click', fechar);
  backdrop.querySelector('#fc-al2').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });

  // Salvar notas em lote
  backdrop.querySelector('#btn-salvar-notas')?.addEventListener('click', async () => {
    const updates = [];
    backdrop.querySelectorAll('tr[data-mat-id]').forEach(tr => {
      const id = tr.dataset.matId;
      const nota = parseFloat(tr.querySelector('.input-nota').value) || null;
      const freq = parseFloat(tr.querySelector('.input-freq').value) || null;
      updates.push({ id, nota_final: nota, frequencia_percent: freq });
    });
    try {
      await Promise.all(updates.map(u => supabase.from('matriculas').update({ nota_final: u.nota_final, frequencia_percent: u.frequencia_percent }).eq('id', u.id)));
      mostrarToast('Notas e frequências salvas!', 'success');
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });

  // Exportar CSV
  backdrop.querySelector('#btn-export-lista')?.addEventListener('click', async () => {
    if (!matriculas?.length) return;
    const rows = [['#','Nome','CPF','Contato','Status','Nota','Frequência%']];
    matriculas.forEach((m, i) => rows.push([i+1, m.alunos?.nome, m.alunos?.cpf, m.alunos?.whatsapp||m.alunos?.telefone, m.status, m.nota_final, m.frequencia_percent]));
    const blob = new Blob(['\uFEFF' + rows.map(r => r.map(v => v||'').join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `lista_${turma?.codigo}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  });

  // Imprimir
  backdrop.querySelector('#btn-imprimir-lista')?.addEventListener('click', () => window.print());
}

function abrirModal(t = null) {
  const v = t || {};
  const cursosOpts = state.cursos.map(c => `<option value="${c.id}" ${v.curso_id===c.id?'selected':''}>${escapeHtml(c.nome)} (${escapeHtml(c.codigo)})</option>`).join('');
  const instrOpts = state.instrutores.map(i => `<option value="${i.id}" ${v.instrutor_id===i.id?'selected':''}>${escapeHtml(i.nome)}</option>`).join('');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${t?'Editar Turma':'Nova Turma'}</h2>
      <button class="btn-icon" id="fc-t"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group"><label>Código *</label><input id="t-cod" value="${escapeHtml(v.codigo||'')}" placeholder="TUR-2025-01"/></div>
      <div class="form-group"><label>Curso *</label><select id="t-curso"><option value="">Selecione...</option>${cursosOpts}</select></div>
      <div class="form-group"><label>Instrutor</label><select id="t-instr"><option value="">— nenhum —</option>${instrOpts}</select></div>
      <div class="form-group"><label>Status</label><select id="t-status">
        <option value="agendada" ${v.status==='agendada'||!v.status?'selected':''}>Agendada</option>
        <option value="em_andamento" ${v.status==='em_andamento'?'selected':''}>Em Andamento</option>
        <option value="concluida" ${v.status==='concluida'?'selected':''}>Concluída</option>
        <option value="cancelada" ${v.status==='cancelada'?'selected':''}>Cancelada</option>
      </select></div>
      <div class="form-group"><label>Data Início *</label><input type="date" id="t-ini" value="${v.data_inicio||''}"/></div>
      <div class="form-group"><label>Data Fim *</label><input type="date" id="t-fim" value="${v.data_fim||''}"/></div>
      <div class="form-group"><label>Horário Início</label><input type="time" id="t-hi" value="${v.horario_inicio||''}"/></div>
      <div class="form-group"><label>Horário Fim</label><input type="time" id="t-hf" value="${v.horario_fim||''}"/></div>
      <div class="form-group"><label>Local</label><input id="t-local" value="${escapeHtml(v.local||'')}"/></div>
      <div class="form-group"><label>Link Online (EAD)</label><input type="url" id="t-link" value="${escapeHtml(v.link_online||'')}" placeholder="https://meet.google.com/..."/></div>
      <div class="form-group"><label>Total de Vagas</label><input type="number" id="t-vagas" value="${v.vagas_total||20}" min="1"/></div>
      <div class="form-group full"><label>Observações</label><textarea id="t-obs">${escapeHtml(v.observacoes||'')}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-t2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-turma"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-t').addEventListener('click', fechar);
  backdrop.querySelector('#fc-t2').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  backdrop.querySelector('#salvar-turma').addEventListener('click', async () => {
    const codigo = backdrop.querySelector('#t-cod').value.trim();
    const curso_id = backdrop.querySelector('#t-curso').value;
    const data_inicio = backdrop.querySelector('#t-ini').value;
    const data_fim = backdrop.querySelector('#t-fim').value;
    if (!codigo || !curso_id || !data_inicio || !data_fim) { mostrarToast('Preencha os campos obrigatórios', 'warning'); return; }
    const vagas_total = parseInt(backdrop.querySelector('#t-vagas').value) || 20;
    const payload = {
      codigo, curso_id, data_inicio, data_fim, vagas_total,
      instrutor_id: backdrop.querySelector('#t-instr').value || null,
      status: backdrop.querySelector('#t-status').value,
      horario_inicio: backdrop.querySelector('#t-hi').value || null,
      horario_fim: backdrop.querySelector('#t-hf').value || null,
      local: backdrop.querySelector('#t-local').value.trim() || null,
      link_online: backdrop.querySelector('#t-link').value.trim() || null,
      observacoes: backdrop.querySelector('#t-obs').value.trim() || null,
      ...(t ? {} : { vagas_disponiveis: vagas_total }),
    };
    try {
      if (t) await supabase.from('turmas').update(payload).eq('id', t.id);
      else await supabase.from('turmas').insert(payload);
      mostrarToast(t ? 'Turma atualizada!' : 'Turma criada!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });
}

async function editarTurma(id) {
  await Promise.all([carregarCursos(), carregarInstrutores()]);
  const { data } = await supabase.from('turmas').select('*').eq('id', id).single();
  abrirModal(data);
}

async function cancelarTurma(id, cod) {
  const ok = await confirmar(`Cancelar a turma <strong>${escapeHtml(cod)}</strong>?`);
  if (!ok) return;
  try {
    await supabase.from('turmas').update({ status: 'cancelada' }).eq('id', id);
    mostrarToast('Turma cancelada', 'success'); carregar(); carregarStats();
  } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
}
