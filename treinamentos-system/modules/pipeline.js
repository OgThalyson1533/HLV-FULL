// modules/pipeline.js — Pipeline Operacional da Jornada do Aluno
import { supabase, mostrarToast } from '../js/app.js';

const COLUNAS = [
  { key: 'matriculado',         label: 'Matriculado',         icon: 'assignment_ind',    cor: '#58a6ff' },
  { key: 'aguardando_turma',    label: 'Aguard. Turma',       icon: 'hourglass_empty',   cor: '#d29922' },
  { key: 'em_andamento',        label: 'Em Andamento',        icon: 'play_circle',       cor: '#00d4ff' },
  { key: 'concluido',           label: 'Concluído',           icon: 'check_circle',      cor: '#3fb950' },
  { key: 'reprovado',           label: 'Reprovado',           icon: 'cancel',            cor: '#f85149' },
  { key: 'certificado_emitido', label: 'Cert. Emitido',       icon: 'workspace_premium', cor: '#bc8cff' },
  { key: 'certificado_vencido', label: 'Cert. Vencido',       icon: 'running_with_errors', cor: '#484f58' },
];

let state = { dados: {}, busca: '', cursos: [], turmas: [], alunos: [], filtroCurso: '' };

export async function renderPipeline() {
  document.getElementById('topbar-title').textContent = 'Pipeline Operacional';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>PIPELINE</h1><p>Jornada completa do aluno</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-nova-matricula"><span class="material-symbols-rounded">add</span> Nova Matrícula</button>
      </div>
    </div>

    <div class="pipeline-toolbar">
      <input type="text" id="busca-pipeline" placeholder="Buscar aluno..." style="width:220px" />
      <select id="filtro-curso-pipe" style="width:200px"><option value="">Todos os cursos</option></select>
      <div style="flex:1"></div>
      <span id="total-matriculas" class="text-muted text-sm"></span>
    </div>

    <div class="pipeline-board" id="pipeline-board"></div>`;

  document.getElementById('btn-nova-matricula').onclick = () => abrirModalMatricula();
  document.getElementById('busca-pipeline').oninput = debounce(e => { state.busca = e.target.value; renderBoard(); }, 200);
  document.getElementById('filtro-curso-pipe').onchange = e => { state.filtroCurso = e.target.value; renderBoard(); };

  await Promise.all([carregarCursos(), carregarTurmas(), carregarAlunos(), carregarDados()]);
  popularFiltroCurso();
}

async function carregarCursos() { const { data } = await supabase.from('cursos').select('id,nome,codigo').eq('ativo', true).order('nome'); state.cursos = data || []; }
async function carregarTurmas() {
  const { data } = await supabase.from('turmas').select('id,codigo,data_inicio,data_fim,curso_id,cursos(nome)').in('status', ['agendada', 'em_andamento']).order('data_inicio');
  state.turmas = data || [];
}
async function carregarAlunos() { const { data } = await supabase.from('alunos').select('id,nome,cpf').eq('ativo', true).order('nome'); state.alunos = data || []; }

async function carregarDados() {
  const { data, error } = await supabase.from('vw_pipeline_operacional').select('*').order('data_matricula', { ascending: false });
  if (error) { mostrarToast('Erro ao carregar pipeline', 'error'); return; }
  state.dados = {};
  COLUNAS.forEach(c => { state.dados[c.key] = []; });
  data.forEach(m => { if (state.dados[m.status]) state.dados[m.status].push(m); });
  renderBoard();
}

function popularFiltroCurso() {
  const sel = document.getElementById('filtro-curso-pipe');
  state.cursos.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome; sel.appendChild(o); });
}

function renderBoard() {
  const board = document.getElementById('pipeline-board');
  if (!board) return;

  const busca = state.busca.toLowerCase();
  let totalVisiveis = 0;

  board.innerHTML = COLUNAS.map(col => {
    let cards = state.dados[col.key] || [];
    if (busca) cards = cards.filter(m => m.aluno_nome?.toLowerCase().includes(busca) || m.aluno_cpf?.includes(busca));
    if (state.filtroCurso) cards = cards.filter(m => m.curso_id === state.filtroCurso || (m.turma_id && state.turmas.find(t => t.id === m.turma_id)?.curso_id === state.filtroCurso));
    totalVisiveis += cards.length;

    return `
      <div class="pipeline-col" data-status="${col.key}">
        <div class="pipeline-col-header" style="border-color:${col.cor}">
          <span class="material-symbols-rounded" style="color:${col.cor};font-size:18px">${col.icon}</span>
          <span class="pipeline-col-label">${col.label}</span>
          <span class="pipeline-count" style="background:${col.cor}22;color:${col.cor}">${cards.length}</span>
        </div>
        <div class="pipeline-cards">
          ${cards.map(m => renderCard(m, col.cor)).join('')}
          ${cards.length === 0 ? `<div class="pipeline-empty">Nenhum aluno</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const el = document.getElementById('total-matriculas');
  if (el) el.textContent = `${totalVisiveis} matrículas`;
}

function renderCard(m, cor) {
  const certInfo = m.cert_validade
    ? `<div class="card-cert ${m.status_certificado}"><span class="material-symbols-rounded" style="font-size:13px">workspace_premium</span> ${fmtData(m.cert_validade)}</div>`
    : '';
  return `
    <div class="pipeline-card" onclick="window._verMatricula('${m.matricula_id}')">
      <div class="card-aluno">${m.aluno_nome}</div>
      <div class="card-curso text-muted text-xs">${m.curso_nome} · ${m.carga_horaria_horas}h</div>
      ${m.turma_codigo ? `<div class="card-turma text-xs"><span class="material-symbols-rounded" style="font-size:12px">group</span> ${m.turma_codigo}</div>` : ''}
      ${certInfo}
      <div class="card-footer">
        <span class="text-xs text-muted">${fmtData(m.data_matricula)}</span>
        <div class="card-actions">
          ${gerarBotoesAcao(m)}
        </div>
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
  if (proximo) btns.push(`<button class="btn-icon" title="Avançar" onclick="event.stopPropagation();window._avancarStatus('${m.matricula_id}','${proximo}')"><span class="material-symbols-rounded" style="color:var(--success);font-size:16px">arrow_forward</span></button>`);
  if (m.status === 'em_andamento') btns.push(`<button class="btn-icon" title="Reprovar" onclick="event.stopPropagation();window._avancarStatus('${m.matricula_id}','reprovado')"><span class="material-symbols-rounded" style="color:var(--danger);font-size:16px">close</span></button>`);
  if (m.status === 'concluido' && !m.certificado_codigo) btns.push(`<button class="btn-icon" title="Emitir Certificado" onclick="event.stopPropagation();window._emitirCert('${m.matricula_id}')"><span class="material-symbols-rounded" style="color:var(--accent);font-size:16px">workspace_premium</span></button>`);
  return btns.join('');
}

// ── Ações ─────────────────────────────────────────────────
window._avancarStatus = async (matriculaId, novoStatus) => {
  const { error } = await supabase.from('matriculas').update({
    status: novoStatus,
    ...(novoStatus === 'concluido' ? { data_conclusao: new Date().toISOString().split('T')[0] } : {}),
    ...(novoStatus === 'em_andamento' ? { data_inicio_efetivo: new Date().toISOString().split('T')[0] } : {}),
  }).eq('id', matriculaId);
  if (error) { mostrarToast('Erro ao atualizar status', 'error'); return; }
  mostrarToast('Status atualizado!', 'success');
  await carregarDados();
};

window._emitirCert = async matriculaId => {
  const { data: mat } = await supabase.from('matriculas').select('*, alunos(nome), cursos(nome,carga_horaria_horas), turmas(instrutor_id, instrutores(nome))').eq('id', matriculaId).single();
  if (!mat) return;
  const { error } = await supabase.from('certificados').insert({
    matricula_id: matriculaId, aluno_id: mat.aluno_id, curso_id: mat.curso_id,
    turma_id: mat.turma_id, carga_horaria_horas: mat.cursos.carga_horaria_horas,
    instrutor_nome: mat.turmas?.instrutores?.nome || null,
  });
  if (error) { mostrarToast('Erro ao emitir certificado: ' + error.message, 'error'); return; }
  await supabase.from('matriculas').update({ status: 'certificado_emitido' }).eq('id', matriculaId);
  mostrarToast('Certificado emitido!', 'success');
  await carregarDados();
};

window._verMatricula = id => abrirDetalhes(id);

async function abrirDetalhes(matriculaId) {
  const { data: m } = await supabase.from('vw_pipeline_operacional').select('*').eq('matricula_id', matriculaId).single();
  const { data: hist } = await supabase.from('matriculas_historico_status').select('*').eq('matricula_id', matriculaId).order('criado_em');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>Detalhes da Matrícula</h2>
      <button class="btn-icon" id="fc-det"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div><div class="text-xs text-muted">Aluno</div><div style="font-weight:600">${m.aluno_nome}</div></div>
        <div><div class="text-xs text-muted">CPF</div><div class="mono">${m.aluno_cpf || '—'}</div></div>
        <div><div class="text-xs text-muted">Curso</div><div>${m.curso_nome}</div></div>
        <div><div class="text-xs text-muted">Turma</div><div>${m.turma_codigo || '—'}</div></div>
        <div><div class="text-xs text-muted">Instrutor</div><div>${m.instrutor_nome || '—'}</div></div>
        <div><div class="text-xs text-muted">Status</div><div><span class="status-badge status-${m.status}">${m.status.replace(/_/g,' ')}</span></div></div>
        <div><div class="text-xs text-muted">Matrícula</div><div>${fmtData(m.data_matricula)}</div></div>
        <div><div class="text-xs text-muted">Conclusão</div><div>${fmtData(m.data_conclusao)}</div></div>
        ${m.cert_emissao ? `<div><div class="text-xs text-muted">Cert. Emissão</div><div>${fmtData(m.cert_emissao)}</div></div>` : ''}
        ${m.cert_validade ? `<div><div class="text-xs text-muted">Cert. Validade</div><div>${fmtData(m.cert_validade)}</div></div>` : ''}
      </div>
      <div class="card-title" style="margin-bottom:12px">Histórico de Status</div>
      <div class="historico-timeline">
        ${(hist || []).map(h => `
          <div class="hist-item">
            <div class="hist-dot"></div>
            <div>
              <div class="text-sm">${h.status_anterior ? `<span class="mono text-xs text-muted">${h.status_anterior}</span> → ` : ''}<strong>${h.status_novo}</strong></div>
              <div class="text-xs text-muted">${new Date(h.criado_em).toLocaleString('pt-BR')}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-det2">Fechar</button>
      <button class="btn btn-primary" onclick="window._abrirEdicaoMatricula('${matriculaId}')"><span class="material-symbols-rounded">edit</span> Editar</button>
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
      <div class="form-group"><label>Nota Final</label><input type="number" id="m-nota" value="${v.nota_final || ''}" min="0" max="10" step="0.1" /></div>
      <div class="form-group"><label>Frequência (%)</label><input type="number" id="m-freq" value="${v.frequencia_percent || ''}" min="0" max="100" /></div>
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

const fmtData = d => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
