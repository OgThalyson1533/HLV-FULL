// ============================================================
// theme.js — White-label / Dynamic Theming / Brand-adaptive UI
// ============================================================

export const DEFAULT_THEME = {
  nome_escola:     'TrainOS',
  cor_primaria:    '#00d4ff',
  cor_secundaria:  '#7c3aed',
  cor_fundo:       '#0a0f1a',
  cor_texto:       '#e6edf3',
  logo_url:        './logo-hlv.png',
  modo:            'dark', // 'dark' | 'light'
  fonte_titulo:    'Inter',
  raio_borda:      '8', // px
};

let _theme = { ...DEFAULT_THEME };

/** Aplica o tema no CSS custom properties */
export function aplicarTema(overrides = {}) {
  _theme = { ...DEFAULT_THEME, ...overrides };

  const r = document.documentElement;

  // Cor primária (accent)
  const hex = _theme.cor_primaria;
  r.style.setProperty('--accent', hex);
  r.style.setProperty('--accent-hover', ajustarBrilho(hex, 20));
  r.style.setProperty('--accent-dim', hexToRgba(hex, 0.15));
  r.style.setProperty('--accent-subtle', hexToRgba(hex, 0.08));

  // Cor secundária
  r.style.setProperty('--secondary', _theme.cor_secundaria);

  // Raio de borda
  r.style.setProperty('--radius-md', _theme.raio_borda + 'px');
  r.style.setProperty('--radius-sm', Math.max(2, parseInt(_theme.raio_borda) - 2) + 'px');
  r.style.setProperty('--radius-lg', (parseInt(_theme.raio_borda) + 4) + 'px');
  r.style.setProperty('--radius-xl', (parseInt(_theme.raio_borda) + 8) + 'px');

  // Modo claro/escuro
  document.documentElement.setAttribute('data-theme', _theme.modo);
  localStorage.setItem('trainos-theme', _theme.modo);

  // Nome da escola na aba
  if (_theme.nome_escola) document.title = _theme.nome_escola;

  // Favicon dinâmico (se tiver logo como data URL)
  if (_theme.logo_url && _theme.logo_url.startsWith('data:')) {
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon'; link.href = _theme.logo_url;
    document.head.appendChild(link);
  }
}

/** Retorna o tema atual */
export function getTema() { return { ..._theme }; }

/** Gera CSS inline de certificado baseado no tema */
export function gerarCSSCertificado() {
  const cor = _theme.cor_primaria;
  const bg  = _theme.cor_fundo;
  const modo = _theme.modo;

  if (modo === 'light') {
    return {
      bgInicio: '#f8f9fa', bgFim: '#e9ecef',
      corTexto: '#212529', corDestaque: cor,
      corBorda: cor, corMuted: '#6c757d',
      corNome: '#1a1a2e', corFundo: '#ffffff',
    };
  }
  return {
    bgInicio: bg || '#0a0f1a', bgFim: ajustarBrilho(bg || '#0a0f1a', 10),
    corTexto: _theme.cor_texto || '#e6edf3', corDestaque: cor,
    corBorda: cor, corMuted: 'rgba(230,237,243,0.4)',
    corNome: '#ffffff', corFundo: bg || '#0a0f1a',
  };
}

// ── Helpers de cor ──────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ajustarBrilho(hex, pct) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + pct);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + pct);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + pct);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

/** Paleta de temas pré-definidos */
export const PALETAS = [
  { nome: 'Azul Neon (Padrão)', cor_primaria: '#00d4ff', cor_secundaria: '#7c3aed', cor_fundo: '#0a0f1a', modo: 'dark' },
  { nome: 'Verde Esmeralda',    cor_primaria: '#10b981', cor_secundaria: '#059669', cor_fundo: '#0a1a12', modo: 'dark' },
  { nome: 'Laranja Fogo',       cor_primaria: '#f59e0b', cor_secundaria: '#d97706', cor_fundo: '#1a1000', modo: 'dark' },
  { nome: 'Rosa Violeta',       cor_primaria: '#ec4899', cor_secundaria: '#8b5cf6', cor_fundo: '#1a0a1a', modo: 'dark' },
  { nome: 'Vermelho Energia',   cor_primaria: '#ef4444', cor_secundaria: '#dc2626', cor_fundo: '#1a0a0a', modo: 'dark' },
  { nome: 'Profissional Claro', cor_primaria: '#2563eb', cor_secundaria: '#7c3aed', cor_fundo: '#f8fafc', modo: 'light' },
  { nome: 'Verde Claro',        cor_primaria: '#16a34a', cor_secundaria: '#15803d', cor_fundo: '#f0fdf4', modo: 'light' },
];
