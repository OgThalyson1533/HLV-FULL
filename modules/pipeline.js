// modules/pipeline.js v3 — Kanban Board com Shared Groups / Swim Lanes
import { supabase, mostrarToast } from '../js/app.js';

// ── Colunas do Kanban ──────────────────────────────────────
const COLUNAS = [
  { key: 'matriculado',         label: 'Matriculado',     icon: 'assignment_ind',      cor: '#58a6ff', grupo: 'ativo' },
  { key: 'aguardando_turma',    label: 'Ag. Turma',       icon: 'hourglass_empty',     cor: '#d29922', grupo: 'ativo' },
  { key: 'em_andamento',        label: 'Em Andamento',    icon: 'play_circle',         cor: '#00d4ff', grupo: 'ativo' },
  { key: 'concluido',           label: 'Concluído',       icon: 'check_circle',        cor: '#3fb950', grupo: 'ativo' },
  { key: 'reprovado',           label: 'Reprovado',       icon: 'cancel',              cor: '#f85149', grupo: 'encerrado' },
  { key: 'certificado_emitido', label: 'Cert. Emitido',   icon: 'workspace_premium',   cor: '#bc8cff', grupo: 'certificado' },
  { key: 'certificado_vencido', label: 'Cert. Vencido',   icon: 'running_with_errors', cor: '#484f58', grupo: 'certificado' },
];

// Grupos de colunas (Shared Groups / Swim Lane headers)
const GRUPOS = [
  { key: 'ativo',        label: '🚀 Jornada Ativa',    cor: '#00d4ff' },
  { key: 'encerrado',    label: '⛔ Encerrado',         cor: '#f85149' },
  { key: 'certificado',  label: '🏆 Certificação',       cor: '#bc8cff' },
];

let state = {
  dados: {},
  busca: '',
  cursos: [],
  turmas: [],
  alunos: [],
  filtroCurso: '',
  viewMode: 'kanban',   // 'kanban' | 'swimlane' | 'list'
  dragId: null,
  dragStatus: null,
};

// ── Render principal ───────────────────────────────────────
export async function renderPipeline() {
  document.getElementById('topbar-title').textContent = 'Pipeline Operacional';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>PIPELINE</h1><p>Jornada completa do aluno</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-nova-matricula">
          <span class="material-symbols-rounded">add</span> Nova Matrícula
        </button>
      </div>
    </div>

    <div class="pipeline-toolbar" style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <input type="text" id="busca-pipeline" placeholder="🔍 Buscar aluno..." style="width:220px"/>
      <select id="filtro-curso-pipe" style="width:200px"><option value="">Todos os cursos</option></select>
      <div style="flex:1"></div>
      <span id="total-matriculas" class="text-muted text-sm"></span>
      <!-- Toggle de visualização -->
      <div style="display:flex;gap:4px;background:var(--bg-overlay);padding:3px;border-radius:8px">
        <button class="view-btn active" data-view="kanban" title="Kanban">
          <span class="material-symbols-rounded" style="font-size:16px">view_kanban</span>
        </button>
        <button class="view-btn" data-view="swimlane" title="Swim Lanes">
          <span class="material-symbols-rounded" style="font-size:16px">table_rows</span>
        </button>
        <button class="view-btn" data-view="list" title="Lista">
          <span class="material-symbols-rounded" style="font-size:16px">list</span>
        </button>
      </div>
    </div>

    <style>
      /* ── View toggle ── */
      .view-btn {
        padding:6px 8px; border:none; border-radius:6px; cursor:pointer;
        background:transparent; color:var(--text-secondary);
        display:flex; align-items:center; transition:all .15s;
      }
      .view-btn.active {
        background:var(--accent); color:#fff;
        box-shadow:0 2px 8px var(--accent-dim);
      }
      .view-btn:hover:not(.active) { background:var(--bg-elevated); color:var(--text-primary); }

      /* ── Kanban Board ── */
      #pipeline-board {
        overflow-x: auto;
        padding-bottom: 16px;
      }
      .kanban-wrap {
        display: flex;
        gap: 12px;
        min-width: max-content;
        align-items: flex-start;
      }

      /* Shared Group separator */
      .kanban-group-sep {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .kanban-group-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-bottom: 4px;
        width: 100%;
      }
      .kanban-group-cols {
        display: flex;
        gap: 12px;
      }

      /* Coluna */
      .pipeline-col {
        width: 230px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-subtle);
        overflow: hidden;
        transition: box-shadow .2s;
      }
      .pipeline-col.drag-over {
        box-shadow: 0 0 0 2px var(--accent);
        background: var(--accent-subtle);
      }
      .pipeline-col-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 2px solid;
        background: var(--bg-overlay);
        flex-shrink: 0;
      }
      .pipeline-col-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        flex: 1;
      }
      .pipeline-count {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 20px;
        font-family: var(--font-mono);
      }
      .pipeline-cards {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 80px;
        flex: 1;
        overflow-y: auto;
        max-height: calc(100vh - 280px);
      }

      /* Card */
      .pipeline-card {
        background: var(--bg-overlay);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 10px 12px;
        cursor: pointer;
        transition: transform .15s, box-shadow .15s, border-color .15s;
        user-select: none;
      }
      .pipeline-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        border-color: var(--accent);
      }
      .pipeline-card.dragging {
        opacity: .5;
        transform: rotate(2deg);
      }
      .card-aluno {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-curso {
        font-size: 11px;
        color: var(--text-secondary);
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-turma {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .card-cert {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 4px;
      }
      .card-cert.valido        { background: #3fb95020; color: #3fb950; }
      .card-cert.a_vencer_60d  { background: #d2992220; color: #d29922; }
      .card-cert.vencido       { background: #f8514920; color: #f85149; }
      .card-cert.sem_validade  { background: var(--bg-overlay); color: var(--text-muted); }
      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid var(--border-subtle);
      }
      .card-actions { display: flex; gap: 2px; }
      .pipeline-empty {
        text-align: center;
        padding: 20px 8px;
        color: var(--text-muted);
        font-size: 12px;
      }

      /* ── Swim Lane view ── */
      .swimlane-wrap {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .swimlane-group {
        border: 1px solid var(--border-default);
        border-radius: 12px;
        overflow: hidden;
      }
      .swimlane-group-header {
        padding: 10px 16px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .swimlane-cols {
        display: flex;
        overflow-x: auto;
        border-top: 1px solid var(--border-subtle);
      }
      .swimlane-col {
        flex: 1;
        min-width: 180px;
        border-right: 1px solid var(--border-subtle);
        padding: 8px;
      }
      .swimlane-col:last-child { border-right: none; }
      .swimlane-col-hdr {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        padding: 4px 6px;
        border-radius: 4px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      /* ── List view ── */
      .list-wrap table { width: 100%; }

      /* Drag handle */
      .drag-handle {
        cursor: grab;
        color: var(--text-muted);
        font-size: 16px;
        vertical-align: middle;
      }
      .drag-handle:active { cursor: grabbing; }
    </style>

    <div id="pipeline-board"></div>`;

  // Eventos
  document.getElementById('btn-nova-matricula').onclick = () => abrirModalMatricula();
  document.getElementById('busca-pipeline').oninput = debounce(e => { state.busca = e.target.value; renderBoard(); }, 200);
  document.getElementById('filtro-curso-pipe').onchange = e => { state.filtroCurso = e.target.value; renderBoard(); };

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.viewMode = btn.dataset.view;
      renderBoard();
    });
  });

  await Promise.all([carregarCursos(), carregarTurmas(), carregarAlunos(), carregarDados()]);
  popularFiltroCurso();
}

// ── Carregamento de dados ─────────────────────────────────
async function carregarCursos() {
  const { data } = await supabase.from('cursos').select('id,nome,codigo').eq('ativo', true).order('nome');
  state.cursos = data || [];
}
async function carregarTurmas() {
  const { data } = await supabase.from('turmas').select('id,codigo,data_inicio,data_fim,curso_id,cursos(nome)').in('status', ['agendada', 'em_andamento']).order('data_inicio');
  state.turmas = data || [];
}
async function carregarAlunos() {
  const { data } = await supabase.from('alunos').select('id,nome,cpf').eq('ativo', true).order('nome');
  state.alunos = data || [];
}
async function carregarDados() {
  const { data, error } = await supabase.from('vw_pipeline_operacional').select('*').order('data_matricula', { ascending: false });
  if (error) { mostrarToast('Erro ao carregar pipeline', 'error'); return; }
  state.dados = {};
  COLUNAS.forEach(c => { state.dados[c.key] = []; });
  (data || []).forEach(m => { if (state.dados[m.status]) state.dados[m.status].push(m); });
  renderBoard();
}

function popularFiltroCurso() {
  const sel = document.getElementById('filtro-curso-pipe');
  if (!sel) return;
  state.cursos.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });
}

// ── Filtros ───────────────────────────────────────────────
function filtrarCards(cards) {
  const busca = state.busca.toLowerCase();
  return cards.filter(m => {
    if (busca && !m.aluno_nome?.toLowerCase().includes(busca) && !m.aluno_cpf?.includes(busca)) return false;
    if (state.filtroCurso && m.curso_id !== state.filtroCurso) return false;
    return true;
  });
}

// ── Render principal do board ─────────────────────────────
function renderBoard() {
  const board = document.getElementById('pipeline-board');
  if (!board) return;

  if (state.viewMode === 'kanban')   renderKanban(board);
  else if (state.viewMode === 'swimlane') renderSwimlane(board);
  else renderList(board);

  // Contagem total
  let total = 0;
  COLUNAS.forEach(c => { total += filtrarCards(state.dados[c.key] || []).length; });
  const el = document.getElementById('total-matriculas');
  if (el) el.textContent = `${total} matrícula${total !== 1 ? 's' : ''}`;
}

// ── VIEW: Kanban com Shared Groups ────────────────────────
function renderKanban(board) {
  // Montar grupos
  const gruposCols = {};
  GRUPOS.forEach(g => { gruposCols[g.key] = []; });
  COLUNAS.forEach(c => { gruposCols[c.grupo]?.push(c); });

  board.innerHTML = `<div class="kanban-wrap">
    ${GRUPOS.map(grupo => {
      const cols = gruposCols[grupo.key] || [];
      return `
        <div class="kanban-group-sep">
          <div class="kanban-group-header" style="background:${grupo.cor}15;color:${grupo.cor};border:1px solid ${grupo.cor}30">
            ${grupo.label}
          </div>
          <div class="kanban-group-cols">
            ${cols.map(col => renderKanbanCol(col)).join('')}
          </div>
        </div>`;
    }).join('')}
  </div>`;

  bindDragDrop();
}

function renderKanbanCol(col) {
  const cards = filtrarCards(state.dados[col.key] || []);
  return `
    <div class="pipeline-col" data-status="${col.key}"
         ondragover="event.preventDefault();this.classList.add('drag-over')"
         ondragleave="this.classList.remove('drag-over')"
         ondrop="window._kanbanDrop(event,'${col.key}')">
      <div class="pipeline-col-header" style="border-color:${col.cor}">
        <span class="material-symbols-rounded" style="color:${col.cor};font-size:16px">${col.icon}</span>
        <span class="pipeline-col-label" style="color:${col.cor}">${col.label}</span>
        <span class="pipeline-count" style="background:${col.cor}22;color:${col.cor}">${cards.length}</span>
      </div>
      <div class="pipeline-cards">
        ${cards.map(m => renderCard(m, col.cor)).join('')}
        ${cards.length === 0 ? `<div class="pipeline-empty">Sem alunos</div>` : ''}
      </div>
    </div>`;
}

// ── VIEW: Swim Lane (agrupado por curso) ──────────────────
function renderSwimlane(board) {
  // Agrupar por curso
  const cursoMap = {};
  COLUNAS.forEach(col => {
    filtrarCards(state.dados[col.key] || []).forEach(m => {
      if (!cursoMap[m.curso_nome]) cursoMap[m.curso_nome] = {};
      if (!cursoMap[m.curso_nome][col.key]) cursoMap[m.curso_nome][col.key] = [];
      cursoMap[m.curso_nome][col.key].push(m);
    });
  });

  const cursos = Object.keys(cursoMap).sort();

  if (!cursos.length) {
    board.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">view_kanban</span><p>Nenhuma matrícula encontrada</p></div>`;
    return;
  }

  board.innerHTML = `<div class="swimlane-wrap">
    <!-- Cabeçalho fixo das colunas -->
    <div style="display:flex;border:1px solid var(--border-default);border-radius:8px;overflow:hidden;background:var(--bg-elevated)">
      <div style="width:160px;flex-shrink:0;padding:8px 12px;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;border-right:1px solid var(--border-subtle)">
        CURSO
      </div>
      ${COLUNAS.map(col => `
        <div style="flex:1;min-width:100px;padding:8px 6px;text-align:center;border-right:1px solid var(--border-subtle)">
          <span class="material-symbols-rounded" style="font-size:14px;color:${col.cor};display:block">${col.icon}</span>
          <div style="font-size:9px;font-weight:700;letter-spacing:0.5px;color:${col.cor};text-transform:uppercase;margin-top:2px">${col.label}</div>
        </div>`).join('')}
    </div>

    ${cursos.map((nome, idx) => {
      const colunas = cursoMap[nome];
      const totalCurso = COLUNAS.reduce((s, c) => s + (colunas[c.key]?.length || 0), 0);
      const bgAlt = idx % 2 === 0 ? 'var(--bg-elevated)' : 'var(--bg-overlay)';
      return `
        <div style="display:flex;border:1px solid var(--border-subtle);border-radius:8px;overflow:hidden;background:${bgAlt}">
          <div style="width:160px;flex-shrink:0;padding:10px 12px;border-right:1px solid var(--border-subtle);display:flex;flex-direction:column;justify-content:center">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${nome}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${totalCurso} aluno${totalCurso !== 1 ? 's' : ''}</div>
          </div>
          ${COLUNAS.map(col => {
            const cards = colunas[col.key] || [];
            return `
              <div style="flex:1;min-width:100px;padding:6px;border-right:1px solid var(--border-subtle);vertical-align:top">
                ${cards.map(m => `
                  <div onclick="window._verMatricula('${m.matricula_id}')"
                    style="background:${col.cor}18;border:1px solid ${col.cor}30;border-radius:6px;padding:5px 7px;margin-bottom:4px;cursor:pointer;font-size:11px;transition:transform .1s"
                    onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform=''">
                    <div style="font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.aluno_nome}</div>
                    ${m.turma_codigo ? `<div style="font-size:9px;color:var(--text-muted)">${m.turma_codigo}</div>` : ''}
                  </div>`).join('')}
                ${cards.length === 0 ? `<div style="color:var(--text-muted);font-size:10px;text-align:center;padding:8px 0">—</div>` : ''}
              </div>`;
          }).join('')}
        </div>`;
    }).join('')}
  </div>`;
}

// ── VIEW: Lista ───────────────────────────────────────────
function renderList(board) {
  const todas = COLUNAS.flatMap(col => filtrarCards(state.dados[col.key] || []).map(m => ({ ...m, _col: col })));
  if (!todas.length) {
    board.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">list</span><p>Nenhuma matrícula encontrada</p></div>`;
    return;
  }
  board.innerHTML = `
    <div class="list-wrap table-container">
      <table><thead><tr>
        <th>Aluno</th><th>Curso</th><th>Turma</th><th>Status</th><th>Matrícula</th><th>Cert. Validade</th><th>Ações</th>
      </tr></thead><tbody>
        ${todas.map(m => `<tr onclick="window._verMatricula('${m.matricula_id}')" style="cursor:pointer">
          <td><strong>${m.aluno_nome}</strong></td>
          <td class="text-sm">${m.curso_nome} <span class="text-muted">${m.carga_horaria_horas}h</span></td>
          <td class="text-sm text-muted">${m.turma_codigo || '—'}</td>
          <td>
            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${m._col.cor}18;color:${m._col.cor}">
              <span class="material-symbols-rounded" style="font-size:12px">${m._col.icon}</span>
              ${m._col.label}
            </span>
          </td>
          <td class="text-sm">${fmtData(m.data_matricula)}</td>
          <td class="text-sm ${m.status_certificado === 'vencido' ? 'text-danger' : m.status_certificado === 'a_vencer_60d' ? 'text-warning' : 'text-muted'}">${m.cert_validade ? fmtData(m.cert_validade) : '—'}</td>
          <td onclick="event.stopPropagation()"><div class="flex gap-2">${gerarBotoesAcao(m)}</div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
}

// ── Card do Kanban ────────────────────────────────────────
function renderCard(m, cor) {
  const certInfo = m.cert_validade
    ? `<div class="card-cert ${m.status_certificado}"><span class="material-symbols-rounded" style="font-size:11px">workspace_premium</span> ${fmtData(m.cert_validade)}</div>`
    : '';
  return `
    <div class="pipeline-card"
      draggable="true"
      data-id="${m.matricula_id}"
      data-status="${m.status}"
      onclick="window._verMatricula('${m.matricula_id}')">
      <div style="display:flex;align-items:flex-start;gap:4px">
        <span class="drag-handle material-symbols-rounded" style="font-size:14px;margin-top:1px" title="Arrastar">drag_indicator</span>
        <div style="flex:1;min-width:0">
          <div class="card-aluno">${m.aluno_nome}</div>
          <div class="card-curso">${m.curso_nome} · ${m.carga_horaria_horas}h</div>
        </div>
      </div>
      ${m.turma_codigo ? `<div class="card-turma"><span class="material-symbols-rounded" style="font-size:11px">group</span>${m.turma_codigo}</div>` : ''}
      ${certInfo}
      <div class="card-footer">
        <span class="text-xs text-muted">${fmtData(m.data_matricula)}</span>
        <div class="card-actions" onclick="event.stopPropagation()">${gerarBotoesAcao(m)}</div>
      </div>
    </div>`;
}

function gerarBotoesAcao(m) {
  const proximos = {
    matriculado: 'aguardando_turma',
    aguardando_turma: 'em_andamento',
    em_andamento: 'concluido',
    concluido: null,
  };
  const proximo = proximos[m.status];
  const btns = [];
  if (proximo) btns.push(`<button class="btn-icon" title="Avançar para ${proximo.replace(/_/g,' ')}" onclick="event.stopPropagation();window._avancarStatus('${m.matricula_id}','${proximo}')"><span class="material-symbols-rounded" style="color:var(--success);font-size:16px">arrow_forward</span></button>`);
  if (m.status === 'em_andamento') btns.push(`<button class="btn-icon" title="Reprovar" onclick="event.stopPropagation();window._avancarStatus('${m.matricula_id}','reprovado')"><span class="material-symbols-rounded" style="color:var(--danger);font-size:16px">close</span></button>`);
  if (m.status === 'concluido' && !m.certificado_codigo) btns.push(`<button class="btn-icon" title="Emitir Certificado" onclick="event.stopPropagation();window._emitirCert('${m.matricula_id}')"><span class="material-symbols-rounded" style="color:var(--accent);font-size:16px">workspace_premium</span></button>`);
  btns.push(`<button class="btn-icon" title="Editar" onclick="event.stopPropagation();window._abrirEdicaoMatricula('${m.matricula_id}')"><span class="material-symbols-rounded" style="font-size:15px">edit</span></button>`);
  return btns.join('');
}

// ── Drag & Drop ───────────────────────────────────────────
function bindDragDrop() {
  document.querySelectorAll('.pipeline-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => {
      state.dragId     = card.dataset.id;
      state.dragStatus = card.dataset.status;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.pipeline-col').forEach(c => c.classList.remove('drag-over'));
    });
  });
}

window._kanbanDrop = async (e, novoStatus) => {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-over');
  const matriculaId = state.dragId;
  const statusAtual = state.dragStatus;
  if (!matriculaId || statusAtual === novoStatus) return;

  const extra = {};
  if (novoStatus === 'concluido')   extra.data_conclusao = new Date().toISOString().split('T')[0];
  if (novoStatus === 'em_andamento') extra.data_inicio_efetivo = new Date().toISOString().split('T')[0];

  const { error } = await supabase.from('matriculas')
    .update({ status: novoStatus, ...extra })
    .eq('id', matriculaId);

  if (error) { mostrarToast('Erro ao mover card: ' + error.message, 'error'); return; }
  mostrarToast(`Status → ${novoStatus.replace(/_/g, ' ')}`, 'success', 2000);
  await carregarDados();
};

// ── Ações ─────────────────────────────────────────────────
window._avancarStatus = async (matriculaId, novoStatus) => {
  const extra = {};
  if (novoStatus === 'concluido')    extra.data_conclusao = new Date().toISOString().split('T')[0];
  if (novoStatus === 'em_andamento') extra.data_inicio_efetivo = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('matriculas').update({ status: novoStatus, ...extra }).eq('id', matriculaId);
  if (error) { mostrarToast('Erro ao atualizar status', 'error'); return; }
  mostrarToast('Status atualizado!', 'success');

  if (novoStatus === 'concluido' || novoStatus === 'reprovado') {
    const { data: mat } = await supabase.from('matriculas').select('*, alunos(nome,whatsapp,telefone), cursos(nome)').eq('id', matriculaId).single();
    if (mat?.alunos?.whatsapp || mat?.alunos?.telefone) {
      const { abrirModalWhatsApp } = await import('../js/whatsapp.js');
      const { getConfig } = await import('../js/supabase.js');
      const nomeEscola = await getConfig('nome_escola', 'TrainOS');
      abrirModalWhatsApp(novoStatus === 'concluido' ? 'aluno_aprovado' : 'aluno_reprovado', {
        nomeAluno: mat.alunos.nome, nomeCurso: mat.cursos.nome,
        nota: mat.nota_final, frequencia: mat.frequencia_percent, nomeEscola,
      }, mat.alunos.whatsapp || mat.alunos.telefone);
    }
  }
  await carregarDados();
};

window._emitirCert = async matriculaId => {
  const { data: mat } = await supabase.from('matriculas')
    .select('*, alunos(nome,whatsapp,telefone), cursos(nome,carga_horaria_horas), turmas(instrutor_id, instrutores(nome))')
    .eq('id', matriculaId).single();
  if (!mat) return;
  const { error } = await supabase.from('certificados').insert({
    matricula_id: matriculaId, aluno_id: mat.aluno_id, curso_id: mat.curso_id,
    turma_id: mat.turma_id, carga_horaria_horas: mat.cursos.carga_horaria_horas,
    instrutor_nome: mat.turmas?.instrutores?.nome || null,
  });
  if (error) { mostrarToast('Erro ao emitir certificado: ' + error.message, 'error'); return; }
  await supabase.from('matriculas').update({ status: 'certificado_emitido' }).eq('id', matriculaId);
  mostrarToast('Certificado emitido!', 'success');

  if (mat.alunos?.whatsapp || mat.alunos?.telefone) {
    const { abrirModalWhatsApp } = await import('../js/whatsapp.js');
    const { getConfig } = await import('../js/supabase.js');
    const nomeEscola = await getConfig('nome_escola', 'TrainOS');
    const { data: cert } = await supabase.from('certificados').select('codigo_verificacao,data_validade').eq('matricula_id', matriculaId).single();
    abrirModalWhatsApp('certificado_emitido', {
      nomeAluno: mat.alunos.nome, nomeCurso: mat.cursos.nome,
      codigoVerificacao: cert?.codigo_verificacao || '—',
      dataValidade: cert?.data_validade ? new Date(cert.data_validade).toLocaleDateString('pt-BR') : null,
      nomeEscola, urlVerificacao: '',
    }, mat.alunos.whatsapp || mat.alunos.telefone);
  }
  await carregarDados();
};

window._verMatricula = id => abrirDetalhes(id);

async function abrirDetalhes(matriculaId) {
  const [{ data: m }, { data: hist }] = await Promise.all([
    supabase.from('vw_pipeline_operacional').select('*').eq('matricula_id', matriculaId).single(),
    supabase.from('matriculas_historico_status').select('*').eq('matricula_id', matriculaId).order('criado_em'),
  ]);
  if (!m) return;

  const col = COLUNAS.find(c => c.key === m.status) || COLUNAS[0];

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header">
      <h2 style="display:flex;align-items:center;gap:8px">
        <span class="material-symbols-rounded" style="color:${col.cor}">${col.icon}</span>
        Detalhes da Matrícula
      </h2>
      <button class="btn-icon" id="fc-det"><span class="material-symbols-rounded">close</span></button>
    </div>
    <div class="modal-body">
      <!-- Status badge -->
      <div style="margin-bottom:16px">
        <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${col.cor}18;color:${col.cor}">
          <span class="material-symbols-rounded" style="font-size:14px">${col.icon}</span>
          ${col.label}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div><div class="text-xs text-muted">Aluno</div><div style="font-weight:600;font-size:14px">${m.aluno_nome}</div></div>
        <div><div class="text-xs text-muted">CPF</div><div class="mono">${m.aluno_cpf || '—'}</div></div>
        <div><div class="text-xs text-muted">Curso</div><div>${m.curso_nome}</div></div>
        <div><div class="text-xs text-muted">Carga Horária</div><div>${m.carga_horaria_horas}h</div></div>
        <div><div class="text-xs text-muted">Turma</div><div>${m.turma_codigo || '—'}</div></div>
        <div><div class="text-xs text-muted">Instrutor</div><div>${m.instrutor_nome || '—'}</div></div>
        <div><div class="text-xs text-muted">Data Matrícula</div><div>${fmtData(m.data_matricula)}</div></div>
        <div><div class="text-xs text-muted">Conclusão</div><div>${fmtData(m.data_conclusao)}</div></div>
        ${m.cert_emissao ? `<div><div class="text-xs text-muted">Cert. Emissão</div><div>${fmtData(m.cert_emissao)}</div></div>` : ''}
        ${m.cert_validade ? `<div><div class="text-xs text-muted">Cert. Validade</div><div class="${m.status_certificado === 'vencido' ? 'text-danger' : ''}">${fmtData(m.cert_validade)}</div></div>` : ''}
        ${m.certificado_codigo ? `<div style="grid-column:1/-1"><div class="text-xs text-muted">Código do Certificado</div><div class="mono" style="color:var(--accent)">${m.certificado_codigo}</div></div>` : ''}
      </div>

      <!-- Ações rápidas -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;padding:12px;background:var(--bg-elevated);border-radius:8px">
        ${gerarBotoesAcao(m)}
        <button class="btn btn-sm btn-secondary" onclick="window._abrirEdicaoMatricula('${matriculaId}')">
          <span class="material-symbols-rounded" style="font-size:14px">edit</span> Editar
        </button>
      </div>

      <!-- Histórico -->
      <div class="card-title" style="margin-bottom:12px">Histórico de Status</div>
      <div class="historico-timeline">
        ${!(hist?.length) ? '<p class="text-muted text-sm">Sem histórico registrado</p>' :
          hist.map((h, i) => {
            const c = COLUNAS.find(c => c.key === h.status_novo);
            return `<div class="hist-item">
              <div class="hist-dot" style="background:${c?.cor || 'var(--accent)'}"></div>
              <div>
                <div class="text-sm">
                  ${h.status_anterior ? `<span class="mono text-xs text-muted">${h.status_anterior.replace(/_/g,' ')}</span> → ` : ''}
                  <strong style="color:${c?.cor || 'var(--text-primary)'}">${h.status_novo.replace(/_/g,' ')}</strong>
                </div>
                <div class="text-xs text-muted">${new Date(h.criado_em).toLocaleString('pt-BR')}</div>
              </div>
            </div>`;
          }).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-det2">Fechar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-det').onclick = fechar;
  document.getElementById('fc-det2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
}

window._abrirEdicaoMatricula = async id => {
  document.querySelector('.modal-backdrop')?.remove();
  const { data } = await supabase.from('matriculas').select('*').eq('id', id).single();
  abrirModalMatricula(data);
};

function abrirModalMatricula(m = null) {
  const v = m || {};
  const alunosOpts = state.alunos.map(a => `<option value="${a.id}" ${v.aluno_id === a.id ? 'selected' : ''}>${a.nome}${a.cpf ? ' · ' + a.cpf : ''}</option>`).join('');
  const cursosOpts = state.cursos.map(c => `<option value="${c.id}" ${v.curso_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
  const turmasOpts = state.turmas.map(t => `<option value="${t.id}" ${v.turma_id === t.id ? 'selected' : ''}>${t.codigo} — ${t.cursos?.nome} (${fmtData(t.data_inicio)})</option>`).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${m ? 'Editar Matrícula' : 'Nova Matrícula'}</h2>
      <button class="btn-icon" id="fc-mat"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group full"><label>Aluno *</label><select id="m-aluno"><option value="">Selecione o aluno...</option>${alunosOpts}</select></div>
      <div class="form-group full"><label>Curso *</label><select id="m-curso"><option value="">Selecione o curso...</option>${cursosOpts}</select></div>
      <div class="form-group full"><label>Turma</label><select id="m-turma"><option value="">— sem turma (aguardando) —</option>${turmasOpts}</select></div>
      <div class="form-group"><label>Status</label><select id="m-status">
        ${COLUNAS.map(c => `<option value="${c.key}" ${v.status === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Nota Final</label><input type="number" id="m-nota" value="${v.nota_final || ''}" min="0" max="10" step="0.1"/></div>
      <div class="form-group"><label>Frequência (%)</label><input type="number" id="m-freq" value="${v.frequencia_percent || ''}" min="0" max="100"/></div>
      <div class="form-group full"><label>Observações</label><textarea id="m-obs">${v.observacoes || ''}</textarea></div>
    </div></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-mat2">Cancelar</button>
      <button class="btn btn-primary" id="salvar-matricula"><span class="material-symbols-rounded">save</span> Salvar</button>
    </div></div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  document.getElementById('fc-mat').onclick = fechar;
  document.getElementById('fc-mat2').onclick = fechar;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.getElementById('salvar-matricula').onclick = async () => {
    const aluno_id = document.getElementById('m-aluno').value;
    const curso_id = document.getElementById('m-curso').value;
    if (!aluno_id || !curso_id) { mostrarToast('Selecione aluno e curso', 'warning'); return; }
    const payload = {
      aluno_id, curso_id,
      turma_id: document.getElementById('m-turma').value || null,
      status: document.getElementById('m-status').value,
      nota_final: parseFloat(document.getElementById('m-nota').value) || null,
      frequencia_percent: parseFloat(document.getElementById('m-freq').value) || null,
      observacoes: document.getElementById('m-obs').value.trim() || null,
    };
    try {
      if (m) await supabase.from('matriculas').update(payload).eq('id', m.id);
      else await supabase.from('matriculas').insert(payload);
      mostrarToast(m ? 'Matrícula atualizada!' : 'Matrícula criada!', 'success');
      fechar(); await carregarDados();
    } catch(e) { mostrarToast('Erro: ' + e.message, 'error'); }
  };
}

// ── Helpers ───────────────────────────────────────────────
const fmtData = d => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
