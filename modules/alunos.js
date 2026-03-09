// modules/alunos.js v2 — CRUD com ficha completa, event delegation
import { supabase, mostrarToast } from '../js/app.js';
import { fmtData, fmtMoeda, debounce, emptyState, renderStatCards, renderPaginacao, delegarAcoes, confirmar, escapeHtml, traduzirErro, skeletonTabela } from '../js/utils.js';

let state = { dados: [], total: 0, pagina: 1, busca: '', filtroTipo: '', empresas: [] };
const PAGE_SIZE = 20;

export async function renderAlunos() {
  document.getElementById('topbar-title').textContent = 'Alunos';
  const el = document.getElementById('main-content');
  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>ALUNOS</h1><p>Cadastro e gestão de alunos</p></div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-novo-aluno"><span class="material-symbols-rounded">person_add</span> Novo Aluno</button>
      </div>
    </div>
    <div class="stats-grid" id="stats-alunos"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-aluno" placeholder="Buscar por nome, CPF ou e-mail..."/></div>
        <select id="filtro-tipo" style="width:160px">
          <option value="">Todos</option>
          <option value="pessoa_fisica">Pessoa Física</option>
          <option value="empresa">Empresa</option>
        </select>
      </div>
      <div id="tabela-alunos-wrap">${skeletonTabela(6,6)}</div>
      <div class="table-footer">
        <span id="info-alunos" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-alunos"></div>
      </div>
    </div>`;

  document.getElementById('btn-novo-aluno').addEventListener('click', () => abrirModal());
  document.getElementById('busca-aluno').addEventListener('input', debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }));
  document.getElementById('filtro-tipo').addEventListener('change', e => { state.filtroTipo = e.target.value; state.pagina = 1; carregar(); });

  // Event delegation para ações da tabela
  delegarAcoes(document.getElementById('tabela-alunos-wrap'), {
    'editar': id => editarAluno(id),
    'ficha': id => abrirFicha(id),
    'deletar': (id, nome) => deletarAluno(id, nome),
  });

  await Promise.all([carregarEmpresas(), carregar(), carregarStats()]);
}

async function carregarStats() {
  const [total, pf, emp, novos] = await Promise.all([
    supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('tipo_cliente', 'pessoa_fisica').eq('ativo', true),
    supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('tipo_cliente', 'empresa').eq('ativo', true),
    supabase.from('alunos').select('*', { count: 'exact', head: true }).gte('criado_em', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  renderStatCards('stats-alunos', [
    { icon: 'group',      label: 'Total Ativos',  value: total.count ?? 0,  cor: 'var(--accent)' },
    { icon: 'person',     label: 'Pessoa Física', value: pf.count ?? 0,     cor: 'var(--info)' },
    { icon: 'business',   label: 'Via Empresa',   value: emp.count ?? 0,    cor: 'var(--warning)' },
    { icon: 'person_add', label: 'Novos (30d)',   value: novos.count ?? 0,  cor: 'var(--success)' },
  ]);
}

async function carregarEmpresas() {
  const { data } = await supabase.from('empresas').select('id,nome_fantasia,razao_social').eq('ativo', true).order('nome_fantasia');
  state.empresas = data || [];
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('alunos').select('*, empresas(nome_fantasia)', { count: 'exact' })
    .eq('ativo', true).order('nome').range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`nome.ilike.%${state.busca}%,cpf.ilike.%${state.busca}%,email.ilike.%${state.busca}%`);
  if (state.filtroTipo) q = q.eq('tipo_cliente', state.filtroTipo);
  const { data, error, count } = await q;
  if (error) { mostrarToast(traduzirErro(error), 'error'); return; }
  state.dados = data; state.total = count;
  renderTabela(data);
  renderPaginacao({ containerId: 'pag-alunos', infoId: 'info-alunos', pagina: state.pagina, total: count, pageSize: PAGE_SIZE, label: 'alunos', onPage: p => { state.pagina = p; carregar(); } });
}

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-alunos-wrap');
  if (!rows?.length) { wrap.innerHTML = emptyState('group_off', 'Nenhum aluno encontrado'); return; }
  wrap.innerHTML = `<table><thead><tr><th>Nome</th><th>CPF</th><th>Contato</th><th>Empresa</th><th>Tipo</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(a => `<tr>
      <td><strong>${escapeHtml(a.nome)}</strong></td>
      <td class="mono text-sm">${escapeHtml(a.cpf || '—')}</td>
      <td class="text-sm">${escapeHtml(a.whatsapp || a.telefone || a.email || '—')}</td>
      <td class="text-sm text-muted">${escapeHtml(a.empresas?.nome_fantasia || '—')}</td>
      <td><span class="badge ${a.tipo_cliente === 'empresa' ? 'badge-warning' : 'badge-info'}">${a.tipo_cliente === 'empresa' ? 'Empresa' : 'PF'}</span></td>
      <td><div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" data-action="ficha" data-id="${a.id}" title="Ficha completa"><span class="material-symbols-rounded" style="font-size:14px">person</span> Ficha</button>
        <button class="btn-icon" data-action="editar" data-id="${a.id}" title="Editar"><span class="material-symbols-rounded">edit</span></button>
        <button class="btn-icon" data-action="deletar" data-id="${a.id}" data-extra="${escapeHtml(a.nome)}" title="Excluir"><span class="material-symbols-rounded" style="color:var(--danger)">delete</span></button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

// ── Ficha completa do aluno (nova funcionalidade) ──────────
async function abrirFicha(id) {
  const [{ data: aluno }, { data: matriculas }, { data: pagamentos }, { data: certs }] = await Promise.all([
    supabase.from('alunos').select('*, empresas(nome_fantasia,razao_social)').eq('id', id).single(),
    supabase.from('matriculas').select('*, cursos(nome), turmas(codigo,data_inicio,data_fim)').eq('aluno_id', id).order('criado_em', { ascending: false }),
    supabase.from('pagamentos').select('*').eq('aluno_id', id).order('criado_em', { ascending: false }),
    supabase.from('certificados').select('*, cursos(nome)').eq('aluno_id', id).order('data_emissao', { ascending: false }),
  ]);
  if (!aluno) return;

  const totalPago = pagamentos?.filter(p => p.status === 'recebido').reduce((s, p) => s + Number(p.valor_recebido || 0), 0) || 0;
  const totalPendente = pagamentos?.filter(p => ['pendente','atraso'].includes(p.status)).reduce((s, p) => s + Number(p.valor_cobrado || 0), 0) || 0;
  const taxaAprov = matriculas?.length ? Math.round(matriculas.filter(m => ['concluido','certificado_emitido','certificado_vencido'].includes(m.status)).length / matriculas.length * 100) : 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg" style="max-width:800px">
    <div class="modal-header">
      <h2><span class="material-symbols-rounded" style="vertical-align:middle;margin-right:8px">person</span>${escapeHtml(aluno.nome)}</h2>
      <button class="btn-icon" id="fc-ficha"><span class="material-symbols-rounded">close</span></button>
    </div>
    <div class="modal-body" style="padding:0">
      <!-- Abas -->
      <div class="tabs" id="ficha-tabs" style="border-bottom:1px solid var(--border-default);padding:0 20px">
        <button class="tab-btn active" data-tab="dados">Dados</button>
        <button class="tab-btn" data-tab="historico">Histórico (${matriculas?.length||0})</button>
        <button class="tab-btn" data-tab="financeiro">Financeiro (${pagamentos?.length||0})</button>
        <button class="tab-btn" data-tab="certificados">Certificados (${certs?.length||0})</button>
      </div>
      <!-- KPIs rápidos -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px 20px;background:var(--bg-elevated)">
        <div style="text-align:center"><div style="font-size:11px;color:var(--text-tertiary)">Total Pago</div><div style="font-size:16px;font-weight:700;color:var(--success)">${fmtMoeda(totalPago)}</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:var(--text-tertiary)">Pendente</div><div style="font-size:16px;font-weight:700;color:var(--warning)">${fmtMoeda(totalPendente)}</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:var(--text-tertiary)">Taxa Aprovação</div><div style="font-size:16px;font-weight:700;color:var(--accent)">${taxaAprov}%</div></div>
      </div>
      <!-- Conteúdo das abas -->
      <div id="tab-content" style="padding:20px">
        <div id="tab-dados">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            ${[
              ['CPF', aluno.cpf], ['RG', aluno.rg], ['Nascimento', fmtData(aluno.data_nascimento)],
              ['E-mail', aluno.email], ['Telefone', aluno.telefone], ['WhatsApp', aluno.whatsapp],
              ['Empresa', aluno.empresas?.nome_fantasia], ['Cargo', aluno.cargo],
              ['Cidade/UF', aluno.cidade ? `${aluno.cidade}/${aluno.estado||''}` : null],
            ].map(([k,v]) => v ? `<div><div class="text-xs text-muted">${k}</div><div class="text-sm">${escapeHtml(v)}</div></div>` : '').join('')}
          </div>
          ${aluno.observacoes ? `<div style="margin-top:12px;padding:10px;background:var(--bg-elevated);border-radius:8px"><div class="text-xs text-muted">Observações</div><div class="text-sm">${escapeHtml(aluno.observacoes)}</div></div>` : ''}
        </div>
        <div id="tab-historico" style="display:none">
          ${!matriculas?.length ? emptyState('school', 'Sem matrículas') : `<table><thead><tr><th>Curso</th><th>Turma</th><th>Status</th><th>Início</th><th>Conclusão</th></tr></thead><tbody>
            ${matriculas.map(m => `<tr>
              <td>${escapeHtml(m.cursos?.nome||'—')}</td>
              <td class="text-sm text-muted">${escapeHtml(m.turmas?.codigo||'—')}</td>
              <td><span class="status-badge status-${m.status}" style="font-size:10px">${m.status.replace(/_/g,' ')}</span></td>
              <td class="text-sm">${fmtData(m.data_inicio_efetivo||m.turmas?.data_inicio)}</td>
              <td class="text-sm">${fmtData(m.data_conclusao)}</td>
            </tr>`).join('')}</tbody></table>`}
        </div>
        <div id="tab-financeiro" style="display:none">
          ${!pagamentos?.length ? emptyState('payments', 'Sem pagamentos') : `<table><thead><tr><th>Recibo</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Recebimento</th></tr></thead><tbody>
            ${pagamentos.map(p => `<tr>
              <td class="mono text-sm">${escapeHtml(p.numero_recibo||'—')}</td>
              <td class="mono">${fmtMoeda(p.valor_cobrado)}</td>
              <td><span class="badge ${p.status==='recebido'?'badge-success':p.status==='atraso'?'badge-danger':'badge-warning'}">${p.status}</span></td>
              <td class="text-sm">${fmtData(p.data_vencimento)}</td>
              <td class="text-sm">${fmtData(p.data_recebimento)}</td>
            </tr>`).join('')}</tbody></table>`}
        </div>
        <div id="tab-certificados" style="display:none">
          ${!certs?.length ? emptyState('workspace_premium', 'Sem certificados') : `<table><thead><tr><th>Código</th><th>Curso</th><th>Emissão</th><th>Validade</th><th>Status</th></tr></thead><tbody>
            ${certs.map(c => {
              const hoje = new Date(); const val = c.data_validade ? new Date(c.data_validade) : null;
              const status = !val ? 'sem_validade' : val < hoje ? 'vencido' : val < new Date(Date.now()+60*86400000) ? 'a_vencer' : 'valido';
              return `<tr>
                <td class="mono text-sm" style="color:var(--accent)">${escapeHtml(c.codigo_verificacao)}</td>
                <td class="text-sm">${escapeHtml(c.cursos?.nome||'—')}</td>
                <td class="text-sm">${fmtData(c.data_emissao)}</td>
                <td class="text-sm">${fmtData(c.data_validade)}</td>
                <td><span class="badge ${status==='valido'?'badge-success':status==='vencido'?'badge-danger':status==='a_vencer'?'badge-warning':'badge-neutral'}">${status.replace(/_/g,' ')}</span></td>
              </tr>`;
            }).join('')}</tbody></table>`}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-ficha2">Fechar</button>
      <button class="btn btn-primary" id="fc-editar-aluno">
        <span class="material-symbols-rounded">edit</span> Editar Dados
      </button>
    </div>
  </div>`;
  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-ficha').addEventListener('click', fechar);
  backdrop.querySelector('#fc-ficha2').addEventListener('click', fechar);
  backdrop.querySelector('#fc-editar-aluno').addEventListener('click', () => { fechar(); editarAluno(id); });
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });

  // Navegação entre abas
  backdrop.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      backdrop.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      ['dados','historico','financeiro','certificados'].forEach(t => {
        backdrop.querySelector(`#tab-${t}`).style.display = t === tab ? 'block' : 'none';
      });
    });
  });
}

// ── Modal de criação/edição ────────────────────────────────
function abrirModal(aluno = null) {
  const emp = state.empresas.map(e => `<option value="${e.id}" ${aluno?.empresa_id === e.id ? 'selected' : ''}>${escapeHtml(e.nome_fantasia || e.razao_social)}</option>`).join('');
  const v = aluno || {};
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h2>${aluno ? 'Editar Aluno' : 'Novo Aluno'}</h2>
      <button class="btn-icon" id="fc-a"><span class="material-symbols-rounded">close</span></button></div>
    <div class="modal-body" style="padding:0">
      ${!aluno ? `
      <!-- Aba de consulta (só no cadastro novo) -->
      <div style="border-bottom:1px solid var(--border-default);padding:0 20px;background:var(--bg-elevated)">
        <div style="display:flex;gap:0">
          <button class="tab-btn active" data-mtab="consulta" style="padding:10px 16px;font-size:12px">🔍 Verificar Cadastro Existente</button>
          <button class="tab-btn" data-mtab="form" style="padding:10px 16px;font-size:12px">✏️ Novo Cadastro</button>
        </div>
      </div>
      <!-- Painel de consulta -->
      <div id="mtab-consulta" style="padding:20px">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          Antes de cadastrar, verifique se o aluno já existe no sistema pelo CPF ou nome.
        </p>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input id="busca-cpf-nome" placeholder="Digite o CPF (000.000.000-00) ou parte do nome..." style="flex:1;padding:10px 14px;background:var(--bg-overlay);border:1px solid var(--border-default);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px"/>
          <button class="btn btn-primary" id="btn-consultar-aluno">
            <span class="material-symbols-rounded" style="font-size:14px">search</span> Buscar
          </button>
        </div>
        <div id="resultado-consulta"></div>
      </div>
      <!-- Painel de formulário (oculto inicialmente) -->
      <div id="mtab-form" style="display:none;padding:20px">` : `<div style="padding:20px">`}
      <div class="form-grid">
      <div class="form-group full"><label>Nome Completo *</label><input id="a-nome" value="${escapeHtml(v.nome||'')}" placeholder="Nome completo"/></div>
      <div class="form-group"><label>CPF</label><input id="a-cpf" value="${escapeHtml(v.cpf||'')}" placeholder="000.000.000-00"/></div>
      <div class="form-group"><label>RG</label><input id="a-rg" value="${escapeHtml(v.rg||'')}"/></div>
      <div class="form-group"><label>Data de Nascimento</label><input type="date" id="a-nasc" value="${v.data_nascimento||''}"/></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="a-email" value="${escapeHtml(v.email||'')}"/></div>
      <div class="form-group"><label>Telefone</label><input id="a-tel" value="${escapeHtml(v.telefone||'')}"/></div>
      <div class="form-group"><label>WhatsApp</label><input id="a-wpp" value="${escapeHtml(v.whatsapp||'')}"/></div>
      <div class="form-group"><label>Tipo</label><select id="a-tipo">
        <option value="pessoa_fisica" ${v.tipo_cliente!=='empresa'?'selected':''}>Pessoa Física</option>
        <option value="empresa" ${v.tipo_cliente==='empresa'?'selected':''}>Empresa</option>
      </select></div>
      <div class="form-group"><label>Empresa</label><select id="a-empresa"><option value="">— nenhuma —</option>${emp}</select></div>
      <div class="form-group"><label>Cargo</label><input id="a-cargo" value="${escapeHtml(v.cargo||'')}"/></div>
      <div class="form-group"><label>CEP <span style="font-size:10px;color:var(--accent)">(preenchimento automático)</span></label><input id="a-cep" value="${escapeHtml(v.cep||'')}" placeholder="00000-000" maxlength="9"/></div>
      <div class="form-group full"><label>Endereço</label><input id="a-endereco" value="${escapeHtml(v.endereco||'')}" placeholder="Rua, número"/></div>
      <div class="form-group"><label>Bairro</label><input id="a-bairro" value="${escapeHtml(v.bairro||'')}"/></div>
      <div class="form-group"><label>Cidade</label><input id="a-cidade" value="${escapeHtml(v.cidade||'')}"/></div>
      <div class="form-group"><label>Estado</label><input id="a-estado" value="${escapeHtml(v.estado||'')}" maxlength="2"/></div>
      <div class="form-group full"><label>Observações</label><textarea id="a-obs">${escapeHtml(v.observacoes||'')}</textarea></div>
      </div>
      ${!aluno ? '</div></div>' : '</div>'}
    </div>
    <div class="modal-footer" id="footer-modal-aluno">
      <button class="btn btn-secondary" id="fc-a2">Cancelar</button>
      ${aluno ? `<button class="btn btn-primary" id="salvar-aluno"><span class="material-symbols-rounded">save</span> Salvar</button>` : ''}
    </div></div>`;
  document.body.appendChild(backdrop);

  // CEP
  import('../js/cep.js').then(({ vincularCEP }) => vincularCEP(backdrop.querySelector('#a-cep'), {
    logradouro: backdrop.querySelector('#a-endereco'),
    bairro:     backdrop.querySelector('#a-bairro'),
    cidade:     backdrop.querySelector('#a-cidade'),
    estado:     backdrop.querySelector('#a-estado'),
  }));

  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-a').addEventListener('click', fechar);
  backdrop.querySelector('#fc-a2').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });

  // ── Lógica das abas no modal de novo aluno ──
  if (!aluno) {
    backdrop.querySelectorAll('[data-mtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        backdrop.querySelectorAll('[data-mtab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.mtab;
        backdrop.querySelector('#mtab-consulta').style.display = tab === 'consulta' ? 'block' : 'none';
        backdrop.querySelector('#mtab-form').style.display = tab === 'form' ? 'block' : 'none';
        // Mostrar/ocultar botão Salvar
        const footer = backdrop.querySelector('#footer-modal-aluno');
        const salvarBtn = footer.querySelector('#salvar-aluno');
        if (tab === 'form') {
          if (!salvarBtn) {
            const btn2 = document.createElement('button');
            btn2.className = 'btn btn-primary'; btn2.id = 'salvar-aluno';
            btn2.innerHTML = '<span class="material-symbols-rounded">save</span> Salvar';
            footer.appendChild(btn2);
            btn2.addEventListener('click', salvarHandler);
          }
        } else {
          if (salvarBtn) salvarBtn.remove();
        }
      });
    });

    // Consulta por CPF / nome
    const doConsulta = async () => {
      const termo = backdrop.querySelector('#busca-cpf-nome').value.trim();
      if (!termo || termo.length < 3) { mostrarToast('Digite ao menos 3 caracteres', 'warning'); return; }
      const resultado = backdrop.querySelector('#resultado-consulta');
      resultado.innerHTML = `<div style="color:var(--text-muted);font-size:13px">🔍 Buscando...</div>`;
      // Busca por CPF exato ou nome parcial
      const { data } = await supabase.from('alunos')
        .select('id,nome,cpf,email,telefone,whatsapp')
        .or(`cpf.eq.${termo},nome.ilike.%${termo}%`)
        .eq('ativo', true)
        .limit(8);
      if (!data?.length) {
        resultado.innerHTML = `
          <div style="padding:16px;background:var(--bg-overlay);border-radius:8px;text-align:center">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
              ✅ Nenhum aluno encontrado com esse CPF/nome.<br>
              <span style="color:var(--text-muted);font-size:12px">Você pode prosseguir com o cadastro.</span>
            </div>
            <button class="btn btn-primary" id="btn-ir-form">
              <span class="material-symbols-rounded" style="font-size:14px">person_add</span> Cadastrar Novo Aluno
            </button>
          </div>`;
        backdrop.querySelector('#btn-ir-form').addEventListener('click', () => {
          backdrop.querySelector('[data-mtab="form"]').click();
        });
        return;
      }
      resultado.innerHTML = `
        <div style="margin-bottom:8px;font-size:12px;color:var(--text-muted)">${data.length} aluno(s) encontrado(s):</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${data.map(a => `
            <div style="padding:12px 16px;background:var(--bg-overlay);border:1px solid var(--border-default);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
              <div>
                <div style="font-weight:600;font-size:13px">${escapeHtml(a.nome)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                  ${a.cpf ? `CPF: ${escapeHtml(a.cpf)}` : ''}
                  ${a.cpf && (a.whatsapp||a.email) ? ' · ' : ''}
                  ${escapeHtml(a.whatsapp||a.email||'')}
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-shrink:0">
                <button class="btn btn-sm btn-secondary btn-abrir-ficha" data-id="${a.id}" style="font-size:11px">
                  <span class="material-symbols-rounded" style="font-size:12px">person</span> Ver Ficha
                </button>
                <button class="btn btn-sm btn-primary btn-editar-exist" data-id="${a.id}" style="font-size:11px">
                  <span class="material-symbols-rounded" style="font-size:12px">edit</span> Editar
                </button>
              </div>
            </div>`).join('')}
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--bg-elevated);border-radius:8px;font-size:12px;color:var(--text-muted)">
          Não é nenhum deles? <button class="btn btn-sm btn-secondary" id="btn-ir-form2" style="margin-left:8px;font-size:11px">
            <span class="material-symbols-rounded" style="font-size:12px">person_add</span> Cadastrar mesmo assim
          </button>
        </div>`;

      backdrop.querySelectorAll('.btn-abrir-ficha').forEach(b => {
        b.addEventListener('click', () => { fechar(); abrirFicha(b.dataset.id); });
      });
      backdrop.querySelectorAll('.btn-editar-exist').forEach(b => {
        b.addEventListener('click', () => { fechar(); editarAluno(b.dataset.id); });
      });
      backdrop.querySelector('#btn-ir-form2')?.addEventListener('click', () => {
        backdrop.querySelector('[data-mtab="form"]').click();
      });
    };

    backdrop.querySelector('#btn-consultar-aluno').addEventListener('click', doConsulta);
    backdrop.querySelector('#busca-cpf-nome').addEventListener('keydown', e => { if (e.key === 'Enter') doConsulta(); });
  }

  const salvarHandler = async () => {
    const nome = backdrop.querySelector('#a-nome').value.trim();
    if (!nome) { mostrarToast('Nome é obrigatório', 'warning'); return; }
    const payload = {
      nome, cpf: backdrop.querySelector('#a-cpf').value.trim() || null,
      rg: backdrop.querySelector('#a-rg').value.trim() || null,
      data_nascimento: backdrop.querySelector('#a-nasc').value || null,
      email: backdrop.querySelector('#a-email').value.trim() || null,
      telefone: backdrop.querySelector('#a-tel').value.trim() || null,
      whatsapp: backdrop.querySelector('#a-wpp').value.trim() || null,
      tipo_cliente: backdrop.querySelector('#a-tipo').value,
      empresa_id: backdrop.querySelector('#a-empresa').value || null,
      cargo: backdrop.querySelector('#a-cargo').value.trim() || null,
      cidade: backdrop.querySelector('#a-cidade').value.trim() || null,
      estado: backdrop.querySelector('#a-estado').value.trim() || null,
      observacoes: backdrop.querySelector('#a-obs').value.trim() || null,
    };
    try {
      if (aluno) await supabase.from('alunos').update(payload).eq('id', aluno.id);
      else await supabase.from('alunos').insert(payload);
      mostrarToast(aluno ? 'Aluno atualizado!' : 'Aluno cadastrado!', 'success');
      fechar(); carregar(); carregarStats();
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  };

  // Botão salvar (edição direta)
  backdrop.querySelector('#salvar-aluno')?.addEventListener('click', salvarHandler);
}

async function editarAluno(id) {
  const { data } = await supabase.from('alunos').select('*').eq('id', id).single();
  abrirModal(data);
}

async function deletarAluno(id, nome) {
  const ok = await confirmar(`Desativar o aluno <strong>${escapeHtml(nome)}</strong>?`);
  if (!ok) return;
  try {
    await supabase.from('alunos').update({ ativo: false }).eq('id', id);
    mostrarToast('Aluno desativado', 'success'); carregar(); carregarStats();
  } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
}

// ── CEP (injetado no modal após criação) ───────────────────
async function _vincularCEPAluno() {
  const { vincularCEP } = await import('../js/cep.js');
  vincularCEP('#a-cep', {
    logradouro: '#a-endereco',
    cidade:     '#a-cidade',
    estado:     '#a-estado',
    bairro:     '#a-bairro',
  });
}
