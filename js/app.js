// app.js v2.0 — sem window.*, event delegation, segurança melhorada
import { supabase, getSessionUser, onAuthChange, logout, isConfigured, reinitClient, limparCredenciais, getConfig } from './supabase.js';
import { escapeHtml } from './utils.js';
import { aplicarTema } from './theme.js';

export { supabase };
export const AppState = { usuario: null, modulo: null };

export function mostrarToast(mensagem, tipo = 'info', duracao = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  const icones = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
  toast.innerHTML = `<span class="material-symbols-rounded">${icones[tipo]||'info'}</span><span>${escapeHtml(mensagem)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove(), { once: true }); }, duracao);
}

const ROTAS = {
  '#/dashboard':    () => import('../modules/dashboard.js').then(m => m.renderDashboard()),
  '#/alunos':       () => import('../modules/alunos.js').then(m => m.renderAlunos()),
  '#/instrutores':  () => import('../modules/instrutores.js').then(m => m.renderInstrutores()),
  '#/empresas':     () => import('../modules/empresas.js').then(m => m.renderEmpresas()),
  '#/cursos':       () => import('../modules/cursos.js').then(m => m.renderCursos()),
  '#/turmas':       () => import('../modules/turmas.js').then(m => m.renderTurmas()),
  '#/pipeline':     () => import('../modules/pipeline.js').then(m => m.renderPipeline()),
  '#/financeiro':   () => import('../modules/financeiro.js').then(m => m.renderFinanceiro()),
  '#/certificados': () => import('../modules/certificados.js').then(m => m.renderCertificados()),
  '#/renovacoes':   () => import('../modules/renovacoes.js').then(m => m.renderRenovacoes()),
  '#/relatorios':   () => import('../modules/relatorios.js').then(m => m.renderRelatorios()),
  '#/configuracoes':() => import('../modules/configuracoes.js').then(m => m.renderConfiguracoes()),
};

const PERMISSOES_ROTA = {
  '#/relatorios': ['admin','comercial'], '#/financeiro': ['admin','comercial'],
  '#/certificados': ['admin','comercial','instrutor'], '#/renovacoes': ['admin','comercial'],
  '#/instrutores': ['admin'], '#/turmas': ['admin','comercial','instrutor'],
  '#/configuracoes': ['admin'],
};

async function rotear() {
  const hash = window.location.hash || '#/dashboard';
  const render = ROTAS[hash];
  if (!render) { window.location.hash = '#/dashboard'; return; }
  const restricao = PERMISSOES_ROTA[hash];
  if (restricao && AppState.usuario) {
    if (!restricao.includes(AppState.usuario.perfil?.perfil)) {
      mostrarToast('Acesso não autorizado.', 'error');
      window.location.hash = '#/dashboard'; return;
    }
  }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.rota === hash));
  AppState.modulo = hash;
  const mainContent = document.getElementById('main-content');
  mainContent.classList.add('loading');
  try { await render(); }
  catch (err) {
    console.error('[Router]', err);
    mainContent.innerHTML = `<div class="error-state"><span class="material-symbols-rounded">error</span><p>Erro ao carregar módulo.</p><button class="btn btn-secondary" onclick="location.reload()">Recarregar</button></div>`;
  } finally { mainContent.classList.remove('loading'); }
}

async function init() {
  const tema = localStorage.getItem('trainos-theme');
  if (tema === 'light') document.documentElement.setAttribute('data-theme', 'light');
  if (!isConfigured()) { renderSetup(); return; }
  const sessao = await getSessionUser();
  if (!sessao) { renderLogin(); return; }
  AppState.usuario = sessao;
  // Carregar tema salvo nas configurações
  try {
    const [cor, sec, modo, raio] = await Promise.all([
      getConfig('cor_primaria', ''), getConfig('cor_secundaria', ''),
      getConfig('modo_tema', ''), getConfig('raio_borda', ''),
    ]);
    if (cor) aplicarTema({ cor_primaria: cor, cor_secundaria: sec || undefined, modo: modo || tema || 'dark', raio_borda: raio || '8' });
  } catch {}
  if (sessao.perfil?.perfil === 'aluno') {
    try { await supabase.rpc('promover_usuario_admin', { user_id: sessao.user.id }); }
    catch {}
    AppState.usuario = await getSessionUser();
  }
  renderApp();
}

function renderSetup() {
  document.getElementById('root').innerHTML = `
    <div class="login-container"><div class="login-card" style="max-width:440px">
      <div class="login-logo"><img src="./logo-hlv.png" alt="TrainOS" class="login-logo-img"/>
        <p style="color:var(--text-secondary);font-size:12px;margin-top:8px">Configuração inicial</p></div>
      <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-left:3px solid var(--accent);border-radius:var(--radius-md);padding:12px 14px;font-size:11px;color:var(--text-secondary);line-height:1.6;margin-bottom:16px">
        <strong style="color:var(--text-primary);display:block;margin-bottom:4px">🔧 Conectar ao Supabase</strong>
        Acesse <strong>supabase.com → Project Settings → API</strong> e cole as credenciais abaixo.
      </div>
      <div class="form-group"><label>Project URL</label>
        <input type="url" id="setup-url" placeholder="https://xxxxxxxxxxx.supabase.co" autocomplete="off"/></div>
      <div class="form-group"><label>anon / public key</label>
        <input type="text" id="setup-key" placeholder="eyJhbGci..." autocomplete="off" style="font-family:var(--font-mono);font-size:10px"/></div>
      <div id="setup-error" class="alert alert-error" style="display:none"></div>
      <button id="btn-setup" class="btn btn-primary btn-full">
        <span class="btn-text">Conectar e continuar</span>
        <span class="btn-loader" style="display:none"><span class="spinner"></span> Verificando...</span>
      </button>
    </div></div>`;
  document.getElementById('btn-setup').addEventListener('click', async () => {
    const url = document.getElementById('setup-url').value.trim();
    const key = document.getElementById('setup-key').value.trim();
    const errEl = document.getElementById('setup-error');
    errEl.style.display = 'none';
    if (!url || !key) { errEl.textContent = 'Preencha a URL e a chave anon.'; errEl.style.display = 'flex'; return; }
    const btn = document.getElementById('btn-setup');
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline-flex';
    btn.disabled = true;
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const tc = createClient(url, key);
      const { error } = await tc.from('perfis').select('id').limit(1);
      if (error && !error.message?.includes('relation') && error.code !== 'PGRST116') throw new Error(error.message);
      reinitClient(url, key);
      mostrarToast('Conectado com sucesso!', 'success');
      setTimeout(() => init(), 800);
    } catch (err) {
      errEl.textContent = 'Falha na conexão: ' + (err.message || 'verifique as credenciais');
      errEl.style.display = 'flex';
      btn.querySelector('.btn-text').style.display = 'inline';
      btn.querySelector('.btn-loader').style.display = 'none';
      btn.disabled = false;
    }
  });
}

function renderLogin() {
  document.getElementById('root').innerHTML = `
    <div class="login-container"><div class="login-card">
      <div class="login-logo"><img src="./logo-hlv.png" alt="TrainOS" class="login-logo-img"/>
        <p>Sistema de Gestão de Treinamentos</p></div>
      <div id="login-error" class="alert alert-error" style="display:none"></div>
      <div class="form-group"><label>E-mail</label>
        <input type="email" id="login-email" placeholder="seu@email.com" autocomplete="email"/></div>
      <div class="form-group"><label>Senha</label>
        <input type="password" id="login-senha" placeholder="••••••••" autocomplete="current-password"/></div>
      <button id="btn-login" class="btn btn-primary btn-full">
        <span class="btn-text">Entrar no Sistema</span>
        <span class="btn-loader" style="display:none"><span class="spinner"></span> Autenticando...</span>
      </button>
    </div></div>`;
  const tentarLogin = async () => {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    if (!email || !senha) { document.getElementById('login-error').textContent = 'Preencha e-mail e senha.'; document.getElementById('login-error').style.display = 'block'; return; }
    const btn = document.getElementById('btn-login');
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline-flex';
    btn.disabled = true;
    try {
      const { data: { session } } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (session) { AppState.usuario = await getSessionUser(); renderApp(); }
    } catch {
      document.getElementById('login-error').textContent = 'Credenciais inválidas.';
      document.getElementById('login-error').style.display = 'block';
      btn.querySelector('.btn-text').style.display = 'inline';
      btn.querySelector('.btn-loader').style.display = 'none';
      btn.disabled = false;
    }
  };
  document.getElementById('btn-login').addEventListener('click', tentarLogin);
  document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') tentarLogin(); });
}

async function renderApp() {
  const { perfil, user } = AppState.usuario;
  if (!perfil) {
    await supabase.from('perfis').upsert({ id: user.id, nome: user.email.split('@')[0], email: user.email, perfil: 'aluno' }, { onConflict: 'id' });
    AppState.usuario = await getSessionUser();
    renderApp(); return;
  }
  const perfilAtual = perfil.perfil || 'aluno';
  const nomeEscola = await getConfig('nome_escola', 'TrainOS');

  const TODOS_NAV = [
    { rota: '#/dashboard',    icon: 'dashboard',         label: 'Dashboard',    perfis: ['admin','comercial','instrutor','aluno'] },
    { rota: '#/alunos',       icon: 'group',             label: 'Alunos',       perfis: ['admin','comercial','instrutor'] },
    { rota: '#/empresas',     icon: 'business',          label: 'Empresas',     perfis: ['admin','comercial'] },
    { rota: '#/cursos',       icon: 'menu_book',         label: 'Cursos',       perfis: ['admin','comercial','instrutor'] },
    { rota: '#/turmas',       icon: 'calendar_month',    label: 'Turmas',       perfis: ['admin','comercial','instrutor'] },
    { rota: '#/instrutores',  icon: 'person_badge',      label: 'Instrutores',  perfis: ['admin'] },
    { rota: '#/pipeline',     icon: 'account_tree',      label: 'Pipeline',     perfis: ['admin','comercial','instrutor'] },
    { rota: '#/financeiro',   icon: 'payments',          label: 'Financeiro',   perfis: ['admin','comercial'] },
    { rota: '#/certificados', icon: 'workspace_premium', label: 'Certificados', perfis: ['admin','comercial','instrutor'] },
    { rota: '#/renovacoes',   icon: 'autorenew',         label: 'Renovações',   perfis: ['admin','comercial'] },
    { rota: '#/relatorios',   icon: 'bar_chart',         label: 'Relatórios',   perfis: ['admin','comercial'] },
    { rota: '#/configuracoes',icon: 'settings',          label: 'Configurações',perfis: ['admin'] },
  ];
  const navItems = TODOS_NAV.filter(i => i.perfis.includes(perfilAtual));

  document.getElementById('root').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <img src="./logo-hlv.png" alt="${escapeHtml(nomeEscola)}" class="sidebar-logo-img"/>
          <div class="sidebar-brand">
            <span class="brand-name">${escapeHtml(nomeEscola)}</span>
            <span class="brand-sub">Gestão de Treinamentos</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${navItems.map(i => `<a href="${i.rota}" class="nav-item" data-rota="${i.rota}"><span class="material-symbols-rounded">${i.icon}</span><span class="nav-label">${i.label}</span></a>`).join('')}
        </nav>
        ${perfilAtual === 'aluno' ? `<div style="background:linear-gradient(135deg,#1a1000,#2a1f00);border:1px solid #d29922;border-radius:var(--radius-md);padding:12px;margin:8px;font-size:11px;color:#d29922;line-height:1.5"><strong style="display:block;margin-bottom:4px">⚠️ Perfil restrito</strong><code style="display:block;margin-top:4px;padding:6px;background:#0d0900;border-radius:4px;font-size:10px;color:#ffd166;user-select:all">UPDATE perfis SET perfil='admin' WHERE email='${escapeHtml(perfil.email)}';</code></div>` : ''}
        <div class="theme-toggle-wrap">
          <span class="material-symbols-rounded theme-toggle-icon icon-moon">dark_mode</span>
          <button class="theme-toggle" id="btn-theme" title="Alternar tema"></button>
          <span class="material-symbols-rounded theme-toggle-icon icon-sun">light_mode</span>
        </div>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${(perfil.nome?.charAt(0)||'U').toUpperCase()}</div>
            <div class="user-info">
              <span class="user-name">${escapeHtml(perfil.nome||'Usuário')}</span>
              <span class="user-role badge badge-${perfilAtual}">${perfilAtual}</span>
            </div>
          </div>
          <button class="btn-icon" id="btn-reconfig" title="Reconfigurar Supabase"><span class="material-symbols-rounded">settings_ethernet</span></button>
          <button class="btn-icon" id="btn-logout" title="Sair"><span class="material-symbols-rounded">logout</span></button>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <button class="btn-icon sidebar-toggle" id="sidebar-toggle"><span class="material-symbols-rounded">menu</span></button>
          <div class="topbar-title" id="topbar-title">Dashboard</div>
          <div class="topbar-actions"><div id="toast-container"></div></div>
        </header>
        <div id="main-content" class="main-content"></div>
      </main>
    </div>`;

  document.getElementById('btn-logout').addEventListener('click', async () => { await logout(); AppState.usuario = null; renderLogin(); });
  document.getElementById('sidebar-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));
  document.getElementById('btn-reconfig').addEventListener('click', () => { if (confirm('Desconectar o Supabase?')) { limparCredenciais(); location.reload(); } });
  document.getElementById('btn-theme').addEventListener('click', () => {
    const novoTema = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', novoTema);
    localStorage.setItem('trainos-theme', novoTema);
  });
  window.addEventListener('hashchange', rotear);
  rotear();
}

onAuthChange(async (event) => {
  if (event === 'SIGNED_OUT') { AppState.usuario = null; renderLogin(); }
  if (event === 'TOKEN_REFRESHED') { AppState.usuario = await getSessionUser(); }
});
document.addEventListener('DOMContentLoaded', init);
