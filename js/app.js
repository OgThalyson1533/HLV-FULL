// ============================================================
// app.js — Bootstrap, roteamento e gerenciamento de estado global
// ============================================================

import { supabase, getSessionUser, onAuthChange, logout } from './supabase.js';

// Re-export para uso nos módulos
export { supabase };

// ============================================================
// ESTADO GLOBAL
// ============================================================

export const AppState = {
  usuario: null,   // { user, perfil }
  modulo: null,    // módulo ativo
  notificacoes: [],
};

// ============================================================
// ROTEADOR SIMPLES (Hash-based SPA)
// ============================================================

const ROTAS = {
  '#/dashboard':     () => import('../modules/dashboard.js').then(m => m.renderDashboard()),
  '#/alunos':        () => import('../modules/alunos.js').then(m => m.renderAlunos()),
  '#/instrutores':   () => import('../modules/instrutores.js').then(m => m.renderInstrutores()),
  '#/empresas':      () => import('../modules/empresas.js').then(m => m.renderEmpresas()),
  '#/cursos':        () => import('../modules/cursos.js').then(m => m.renderCursos()),
  '#/turmas':        () => import('../modules/turmas.js').then(m => m.renderTurmas()),
  '#/pipeline':      () => import('../modules/pipeline.js').then(m => m.renderPipeline()),
  '#/financeiro':    () => import('../modules/financeiro.js').then(m => m.renderFinanceiro()),
  '#/certificados':  () => import('../modules/certificados.js').then(m => m.renderCertificados()),
  '#/renovacoes':    () => import('../modules/renovacoes.js').then(m => m.renderRenovacoes()),
  '#/relatorios':    () => import('../modules/relatorios.js').then(m => m.renderRelatorios()),
};

// Mapeamento de permissões por rota
const PERMISSOES_ROTA = {
  '#/relatorios':   ['admin', 'comercial'],
  '#/financeiro':   ['admin', 'comercial'],
  '#/certificados': ['admin', 'comercial', 'instrutor'],
  '#/renovacoes':   ['admin', 'comercial'],
  '#/instrutores':  ['admin'],
  '#/turmas':       ['admin', 'comercial', 'instrutor'],
};

async function rotear() {
  const hash = window.location.hash || '#/dashboard';
  const render = ROTAS[hash];

  if (!render) {
    window.location.hash = '#/dashboard';
    return;
  }

  // Verificar permissões
  const restricao = PERMISSOES_ROTA[hash];
  if (restricao && AppState.usuario) {
    const perfilAtual = AppState.usuario.perfil?.perfil;
    if (!restricao.includes(perfilAtual)) {
      mostrarToast('Acesso não autorizado para este módulo.', 'error');
      window.location.hash = '#/dashboard';
      return;
    }
  }

  // Atualizar navegação ativa
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.rota === hash);
  });

  AppState.modulo = hash;

  const mainContent = document.getElementById('main-content');
  mainContent.classList.add('loading');

  try {
    await render();
  } catch (err) {
    console.error('[Router] Erro ao renderizar módulo:', err);
    mainContent.innerHTML = `<div class="error-state">
      <span class="material-symbols-rounded">error</span>
      <p>Erro ao carregar módulo. Tente novamente.</p>
    </div>`;
  } finally {
    mainContent.classList.remove('loading');
  }
}

// ============================================================
// BOOTSTRAP
// ============================================================

async function init() {
  // Restaurar tema salvo antes de qualquer render
  const temaSalvo = localStorage.getItem('trainos-theme');
  if (temaSalvo === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  const sessao = await getSessionUser();
  if (!sessao) { renderLogin(); return; }

  AppState.usuario = sessao;

  // AUTO-PROMOÇÃO: primeiro usuário do sistema vira admin automaticamente
  if (sessao.perfil?.perfil === 'aluno') {
    await verificarEPromoverPrimeiroAdmin(sessao);
    AppState.usuario = await getSessionUser();
  }

  renderApp();
}

async function verificarEPromoverPrimeiroAdmin(sessao) {
  try {
    const { count } = await supabase
      .from('perfis')
      .select('*', { count: 'exact', head: true });
    if (count === 1) {
      await supabase.from('perfis').update({ perfil: 'admin' }).eq('id', sessao.user.id);
      console.info('[TrainOS] Primeiro usuário promovido automaticamente para admin.');
    }
  } catch (e) {
    console.warn('[TrainOS] verificarEPromoverPrimeiroAdmin:', e.message);
  }
}

// ============================================================
// RENDER: TELA DE LOGIN
// ============================================================

function renderLogin() {
  document.getElementById('root').innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo">
          <img src="./logo-hlv.jpg" alt="HLV" class="login-logo-img" />
          <p>Sistema de Gestão de Treinamentos</p>
        </div>

        <div id="login-error" class="alert alert-error" style="display:none"></div>

        <div class="form-group">
          <label>E-mail</label>
          <input type="email" id="login-email" placeholder="seu@email.com" autocomplete="email" />
        </div>

        <div class="form-group">
          <label>Senha</label>
          <input type="password" id="login-senha" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <button id="btn-login" class="btn btn-primary btn-full">
          <span class="btn-text">Entrar no Sistema</span>
          <span class="btn-loader" style="display:none">
            <span class="spinner"></span> Autenticando...
          </span>
        </button>
      </div>
    </div>
  `;

  const btnLogin = document.getElementById('btn-login');
  const inputEmail = document.getElementById('login-email');
  const inputSenha = document.getElementById('login-senha');

  async function tentarLogin() {
    const email = inputEmail.value.trim();
    const senha = inputSenha.value;

    if (!email || !senha) {
      mostrarErroLogin('Preencha e-mail e senha.');
      return;
    }

    btnLogin.querySelector('.btn-text').style.display = 'none';
    btnLogin.querySelector('.btn-loader').style.display = 'inline-flex';
    btnLogin.disabled = true;

    try {
      const { data: { session } } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (session) {
        AppState.usuario = await getSessionUser();
        renderApp();
      }
    } catch (err) {
      mostrarErroLogin('Credenciais inválidas. Verifique e-mail e senha.');
      btnLogin.querySelector('.btn-text').style.display = 'inline';
      btnLogin.querySelector('.btn-loader').style.display = 'none';
      btnLogin.disabled = false;
    }
  }

  btnLogin.addEventListener('click', tentarLogin);
  inputSenha.addEventListener('keydown', e => { if (e.key === 'Enter') tentarLogin(); });
}

function mostrarErroLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ============================================================
// RENDER: APP SHELL
// ============================================================

function renderApp() {
  const { perfil, user } = AppState.usuario;

  // Perfil pode ser null se o trigger ainda não criou o registro (race condition no primeiro login)
  // Nesse caso, tenta criar manualmente e recarrega
  if (!perfil) {
    supabase.from('perfis').upsert({
      id: user.id,
      nome: user.email.split('@')[0],
      email: user.email,
      perfil: 'aluno',
    }, { onConflict: 'id' }).then(() => {
      getSessionUser().then(s => { AppState.usuario = s; renderApp(); });
    });
    return;
  }

  const perfilAtual = perfil.perfil || 'aluno';

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
  ];

  const navItems = TODOS_NAV.filter(item => item.perfis.includes(perfilAtual));

  // Banner de aviso quando perfil ainda é 'aluno' (primeiro uso / admin não promovido)
  const bannerAdmin = perfilAtual === 'aluno' ? `
    <div id="banner-perfil" style="
      background: linear-gradient(135deg, #1a1000, #2a1f00);
      border: 1px solid #d29922;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 8px;
      font-size: 11px;
      color: #d29922;
      line-height: 1.5;
    ">
      <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <span class="material-symbols-rounded" style="font-size:15px">warning</span>
        Perfil restrito (aluno)
      </div>
      <div style="color:rgba(210,153,34,0.8);margin-bottom:8px">
        Para acessar todos os módulos, execute no <strong>SQL Editor</strong> do Supabase:
      </div>
      <code style="
        display:block;
        background:#0d0900;
        border:1px solid #d2992244;
        border-radius:4px;
        padding:8px;
        font-size:10px;
        color:#ffd166;
        word-break:break-all;
        user-select:all;
        cursor:text;
      ">UPDATE perfis SET perfil = 'admin' WHERE email = '${perfil.email}';</code>
      <div style="margin-top:8px;color:rgba(210,153,34,0.6)">Após executar, faça logout e login novamente.</div>
    </div>` : '';

  document.getElementById('root').innerHTML = `
    <div class="app-shell">
      <!-- SIDEBAR -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <img src="./logo-hlv.jpg" alt="HLV" class="sidebar-logo-img" />
          <div class="sidebar-brand">
            <span class="brand-name">HLV</span>
            <span class="brand-sub">Gestão de Treinamentos</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <a href="${item.rota}" class="nav-item" data-rota="${item.rota}">
              <span class="material-symbols-rounded">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
            </a>
          `).join('')}
        </nav>

        ${bannerAdmin}

        <!-- Theme toggle -->
        <div class="theme-toggle-wrap">
          <span class="material-symbols-rounded theme-toggle-icon icon-moon">dark_mode</span>
          <button class="theme-toggle" id="btn-theme" title="Alternar tema claro/escuro" aria-label="Alternar tema"></button>
          <span class="material-symbols-rounded theme-toggle-icon icon-sun">light_mode</span>
        </div>

        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${perfil.nome?.charAt(0)?.toUpperCase() || 'U'}</div>
            <div class="user-info">
              <span class="user-name">${perfil.nome || 'Usuário'}</span>
              <span class="user-role badge badge-${perfilAtual}">${perfilAtual}</span>
            </div>
          </div>
          <button class="btn-icon" id="btn-logout" title="Sair">
            <span class="material-symbols-rounded">logout</span>
          </button>
        </div>
      </aside>

      <!-- MAIN -->
      <main class="main-area">
        <header class="topbar">
          <button class="btn-icon sidebar-toggle" id="sidebar-toggle">
            <span class="material-symbols-rounded">menu</span>
          </button>
          <div class="topbar-title" id="topbar-title">Dashboard</div>
          <div class="topbar-actions">
            <div id="toast-container"></div>
          </div>
        </header>

        <div id="main-content" class="main-content"></div>
      </main>
    </div>
  `;

  // Event listeners
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    AppState.usuario = null;
    renderLogin();
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Theme toggle — persiste em localStorage
  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const novoTema = isLight ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', novoTema);
      localStorage.setItem('trainos-theme', novoTema);
    });
  }

  // Roteador
  window.addEventListener('hashchange', rotear);
  rotear();
}

// ============================================================
// TOAST NOTIFICATIONS (utilitário global)
// ============================================================

export function mostrarToast(mensagem, tipo = 'info', duracao = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;

  const icones = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
  toast.innerHTML = `
    <span class="material-symbols-rounded">${icones[tipo] || 'info'}</span>
    <span>${mensagem}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duracao);
}

// ============================================================
// LISTENER DE AUTH (token refresh / logout externo)
// ============================================================

onAuthChange(async (event) => {
  if (event === 'SIGNED_OUT') {
    AppState.usuario = null;
    renderLogin();
  }
  if (event === 'TOKEN_REFRESHED') {
    AppState.usuario = await getSessionUser();
  }
});

// ============================================================
// START
// ============================================================

document.addEventListener('DOMContentLoaded', init);
