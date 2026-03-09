// modules/dashboard.js — Dashboard Principal com KPIs e Gráficos
import { supabase } from '../js/supabase.js';
import { AppState } from '../js/app.js';

export async function renderDashboard() {
  document.getElementById('topbar-title').textContent = 'Dashboard';

  // Verifica se o usuário ainda é 'aluno' (promoção automática pode ter falhado por RLS)
  const perfilAtual = AppState.usuario?.perfil?.perfil;
  const bannerAdmin = perfilAtual === 'aluno' ? `
    <div class="banner-alerta">
      <span class="material-symbols-rounded">admin_panel_settings</span>
      <div>
        <strong>Seu perfil está como "aluno"</strong> — você só vê o Dashboard.
        Para ter acesso completo, execute no <strong>Supabase SQL Editor</strong>:
        <code style="display:block;margin-top:6px;padding:6px 10px;background:rgba(0,0,0,0.4);border-radius:4px;font-size:12px;user-select:all">
          UPDATE perfis SET perfil = 'admin' WHERE email = '${AppState.usuario?.user?.email}';
        </code>
        Depois faça logout e login novamente.
      </div>
      <button class="btn btn-sm btn-primary" onclick="window._promoverAdmin()">
        <span class="material-symbols-rounded">upgrade</span> Tentar promover agora
      </button>
    </div>` : '';

  document.getElementById('main-content').innerHTML = `
    ${bannerAdmin}
    <div class="page-header">
      <div class="page-header-left">
        <h1>DASHBOARD</h1>
        <p id="dash-timestamp" class="text-muted text-sm"></p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="renderDashboard()"><span class="material-symbols-rounded">refresh</span> Atualizar</button>
      </div>
    </div>

    <div class="stats-grid" id="kpis-principais"></div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px">
      <div class="card" id="card-pipeline-resumo"></div>
      <div class="card" id="card-alertas-rapidos"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div class="card" id="card-fin-mensal"></div>
      <div class="card" id="card-cursos-pop"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div class="card" id="card-turmas-proximas"></div>
      <div class="card" id="card-ultimas-matriculas"></div>
    </div>`;

  document.getElementById('dash-timestamp').textContent =
    'Atualizado em ' + new Date().toLocaleString('pt-BR');

  await Promise.all([
    carregarKPIs(),
    carregarPipelineResumo(),
    carregarAlertasRapidos(),
    carregarFinMensal(),
    carregarCursosPopulares(),
    carregarTurmasProximas(),
    carregarUltimasMatriculas(),
  ]);
}

async function carregarKPIs() {
  const hoje = new Date().toISOString().split('T')[0];
  const mesInicio = new Date(); mesInicio.setDate(1); const mesStr = mesInicio.toISOString().split('T')[0];

  const [alunos, emAndamento, certsMes, pgMes, alertas] = await Promise.all([
    supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('matriculas').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
    supabase.from('certificados').select('*', { count: 'exact', head: true }).gte('data_emissao', mesStr),
    supabase.from('pagamentos').select('valor_recebido').eq('status', 'recebido').gte('data_recebimento', mesStr),
    supabase.from('vw_alertas_renovacao').select('*', { count: 'exact', head: true }),
  ]);

  const recMes = (pgMes.data || []).reduce((s, r) => s + (parseFloat(r.valor_recebido) || 0), 0);
  const fmtR = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 });

  document.getElementById('kpis-principais').innerHTML = [
    { icon: 'group', label: 'Alunos Ativos', value: alunos.count ?? 0, cor: 'var(--accent)', link: '#/alunos' },
    { icon: 'play_circle', label: 'Em Treinamento', value: emAndamento.count ?? 0, cor: 'var(--info)', link: '#/pipeline' },
    { icon: 'workspace_premium', label: 'Certs (Mês)', value: certsMes.count ?? 0, cor: 'var(--success)', link: '#/certificados' },
    { icon: 'payments', label: 'Recebido (Mês)', value: fmtR(recMes), cor: 'var(--warning)', link: '#/financeiro' },
    { icon: 'running_with_errors', label: 'Alertas Renovação', value: alertas.count ?? 0, cor: 'var(--danger)', link: '#/renovacoes' },
  ].map(s => `
    <div class="stat-card" onclick="window.location.hash='${s.link}'" style="cursor:pointer">
      <div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div>
      <div class="stat-value" style="${typeof s.value === 'string' ? 'font-size:18px' : ''}">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

async function carregarPipelineResumo() {
  const { data } = await supabase.from('matriculas').select('status').neq('status', null);
  const counts = {};
  (data || []).forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  const steps = [
    { key: 'matriculado',         label: 'Matriculado',    cor: '#58a6ff' },
    { key: 'aguardando_turma',    label: 'Ag. Turma',      cor: '#d29922' },
    { key: 'em_andamento',        label: 'Em Andamento',   cor: '#00d4ff' },
    { key: 'concluido',           label: 'Concluído',      cor: '#3fb950' },
    { key: 'certificado_emitido', label: 'Certificado',    cor: '#bc8cff' },
    { key: 'certificado_vencido', label: 'Cert. Vencido',  cor: '#484f58' },
  ];

  document.getElementById('card-pipeline-resumo').innerHTML = `
    <div class="card-header"><span class="card-title">PIPELINE — DISTRIBUIÇÃO</span><span class="text-muted text-xs">${total} total</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${steps.map(s => {
        const qtd = counts[s.key] || 0;
        const pct = total > 0 ? Math.round(qtd / total * 100) : 0;
        return `<div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;color:${s.cor}">${s.label}</span>
            <span style="font-size:12px;font-family:var(--font-mono);color:${s.cor}">${qtd} (${pct}%)</span>
          </div>
          <div style="height:6px;background:var(--bg-overlay);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${s.cor};border-radius:3px;transition:width 0.5s ease"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function carregarAlertasRapidos() {
  const { data } = await supabase.from('vw_alertas_renovacao').select('aluno_nome,curso_nome,data_validade,nivel_alerta,dias_vencido').in('nivel_alerta', ['vencido','critico_30d']).order('data_validade').limit(8);
  const el = document.getElementById('card-alertas-rapidos');
  el.innerHTML = `<div class="card-header"><span class="card-title">🚨 ALERTAS URGENTES</span>
    <a href="#/renovacoes" style="font-size:11px;color:var(--accent)">Ver todos →</a></div>
    ${!data?.length ? `<div class="empty-state" style="padding:20px"><span class="material-symbols-rounded" style="color:var(--success)">check_circle</span><p>Sem alertas críticos!</p></div>` :
    data.map(r => {
      const dias = r.dias_vencido;
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="font-size:12px;font-weight:600">${r.aluno_nome}</div>
          <div class="text-xs text-muted">${r.curso_nome}</div>
        </div>
        <div class="text-danger text-xs mono" style="text-align:right;font-weight:700">${dias > 0 ? dias + 'd' : Math.abs(dias) + 'r'}</div>
      </div>`;
    }).join('')}`;
}

async function carregarFinMensal() {
  const { data } = await supabase.from('vw_financeiro_resumo').select('*').limit(6);
  const el = document.getElementById('card-fin-mensal');
  if (!data?.length) { el.innerHTML = `<div class="card-header"><span class="card-title">FINANCEIRO MENSAL</span></div><div class="empty-state" style="padding:20px"><p>Sem dados</p></div>`; return; }
  const maxVal = Math.max(...data.map(d => parseFloat(d.total_recebido) || 0), 1);
  el.innerHTML = `
    <div class="card-header"><span class="card-title">FINANCEIRO MENSAL</span>
      <a href="#/financeiro" style="font-size:11px;color:var(--accent)">Ver mais →</a></div>
    <div class="chart-bars">
      ${data.slice().reverse().map(d => {
        const rec = parseFloat(d.total_recebido) || 0;
        const pend = parseFloat(d.total_pendente) || 0;
        const pct = (rec / maxVal * 100);
        const mes = new Date(d.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        return `<div class="chart-bar-group">
          <div class="chart-bar-wrap">
            <div class="chart-bar-value">R$${(rec/1000).toFixed(1)}k</div>
            <div class="chart-bar" style="height:${Math.max(pct, 2)}%">
              ${pend > 0 ? `<div style="position:absolute;top:0;width:100%;height:${Math.min(pend/rec*100,30)}%;background:rgba(210,153,34,0.4)"></div>` : ''}
            </div>
          </div>
          <div class="chart-bar-label">${mes}</div>
        </div>`;
      }).join('')}
    </div>`;
}

async function carregarCursosPopulares() {
  const { data } = await supabase.from('matriculas').select('curso_id, cursos(nome)').eq('ativo', true).limit(500);
  // Agrupar manualmente
  const map = {};
  (data || []).forEach(m => {
    const nome = m.cursos?.nome || 'Desconhecido';
    map[nome] = (map[nome] || 0) + 1;
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  const cores = ['#00d4ff','#58a6ff','#3fb950','#bc8cff','#d29922','#f85149','#ff7c7c','#7ee8a2'];
  document.getElementById('card-cursos-pop').innerHTML = `
    <div class="card-header"><span class="card-title">CURSOS MAIS DEMANDADOS</span></div>
    ${sorted.length === 0 ? '<div class="empty-state" style="padding:20px"><p>Sem dados</p></div>' :
    `<div style="display:flex;flex-direction:column;gap:8px">
      ${sorted.map(([nome, qtd], i) => `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:12px;color:${cores[i % cores.length]}">${nome}</span>
            <span style="font-size:12px;font-family:var(--font-mono);color:${cores[i % cores.length]}">${qtd}</span>
          </div>
          <div style="height:4px;background:var(--bg-overlay);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${qtd/max*100}%;background:${cores[i % cores.length]};transition:width 0.5s ease"></div>
          </div>
        </div>`).join('')}
    </div>`}`;
}

async function carregarTurmasProximas() {
  const hoje = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('turmas').select('*, cursos(nome), instrutores(nome)').gte('data_inicio', hoje).in('status', ['agendada','em_andamento']).order('data_inicio').limit(6);
  document.getElementById('card-turmas-proximas').innerHTML = `
    <div class="card-header"><span class="card-title">PRÓXIMAS TURMAS</span>
      <a href="#/turmas" style="font-size:11px;color:var(--accent)">Ver todas →</a></div>
    ${!data?.length ? `<div class="empty-state" style="padding:20px"><p>Sem turmas agendadas</p></div>` :
    data.map(t => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="font-size:13px;font-weight:600">${t.cursos?.nome || '—'}</div>
          <div class="text-xs text-muted">${t.codigo} · ${t.instrutores?.nome || 'Sem instrutor'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;font-family:var(--font-mono);color:var(--accent)">${fmtData(t.data_inicio)}</div>
          <div class="text-xs text-muted">${t.vagas_disponiveis}/${t.vagas_total} vagas</div>
        </div>
      </div>`).join('')}`;
}

async function carregarUltimasMatriculas() {
  const { data } = await supabase.from('matriculas').select('*, alunos(nome), cursos(nome)').order('criado_em', { ascending: false }).limit(8);
  document.getElementById('card-ultimas-matriculas').innerHTML = `
    <div class="card-header"><span class="card-title">ÚLTIMAS MATRÍCULAS</span>
      <a href="#/pipeline" style="font-size:11px;color:var(--accent)">Ver pipeline →</a></div>
    ${!data?.length ? `<div class="empty-state" style="padding:20px"><p>Sem matrículas</p></div>` :
    data.map(m => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-subtle)">
        <div>
          <div style="font-size:13px;font-weight:600">${m.alunos?.nome || '—'}</div>
          <div class="text-xs text-muted">${m.cursos?.nome || '—'}</div>
        </div>
        <div style="text-align:right">
          <span class="status-badge status-${m.status}" style="font-size:10px">${m.status.replace(/_/g,' ')}</span>
          <div class="text-xs text-muted" style="margin-top:2px">${new Date(m.criado_em).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>`).join('')}`;
}

const fmtData = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// Tenta promover o usuário atual para admin (funciona se RLS permitir self-update)
window._promoverAdmin = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Tenta via RPC sem restrição de RLS
  const { error } = await supabase.rpc('promover_usuario_admin', { user_id: user.id });

  if (!error) {
    alert('Promovido! Fazendo logout para recarregar permissões...');
    await supabase.auth.signOut();
    window.location.reload();
  } else {
    // Fallback: mostra o SQL para copiar
    alert(
      'Não foi possível promover automaticamente (RLS bloqueou).\n\n' +
      'Execute este comando no Supabase SQL Editor:\n\n' +
      `UPDATE perfis SET perfil = 'admin' WHERE email = '${user.email}';`
    );
  }
};
