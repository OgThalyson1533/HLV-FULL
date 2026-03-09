// ============================================================
// utils.js — Utilitários compartilhados (sem duplicação nos módulos)
// ============================================================

// ── Formatação ─────────────────────────────────────────────
export const fmtData = d =>
  d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export const fmtDataHora = d =>
  d ? new Date(d).toLocaleString('pt-BR') : '—';

export const fmtMoeda = v =>
  v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—';

export const fmtMoedaCurta = v =>
  v != null ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '—';

// ── Segurança: sanitiza strings antes de inserir no DOM ────
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Debounce ───────────────────────────────────────────────
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Empty state reutilizável ───────────────────────────────
export function emptyState(icon, msg, sub = '') {
  return `<div class="empty-state">
    <span class="material-symbols-rounded">${icon}</span>
    <p>${msg}</p>
    ${sub ? `<span class="text-muted text-sm">${sub}</span>` : ''}
  </div>`;
}

// ── Stat cards reutilizáveis ───────────────────────────────
export function renderStatCards(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = items.map(s => `
    <div class="stat-card${s.link ? ' stat-card-link' : ''}"
         ${s.link ? `onclick="window.location.hash='${s.link}'"` : ''}>
      <div class="stat-icon" style="color:${s.cor}">
        <span class="material-symbols-rounded">${s.icon}</span>
      </div>
      <div class="stat-value" style="${typeof s.value === 'string' && s.value.startsWith('R$') ? 'font-size:16px' : ''}">
        ${s.value}
      </div>
      <div class="stat-label">${s.label}</div>
      ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
    </div>`).join('');
}

// ── Paginação reutilizável ─────────────────────────────────
export function renderPaginacao(opts) {
  const { containerId, infoId, pagina, total, pageSize, onPage } = opts;
  const pages = Math.ceil(total / pageSize);

  const info = document.getElementById(infoId);
  if (info) info.textContent = `${total.toLocaleString('pt-BR')} ${opts.label || 'registros'}`;

  const pg = document.getElementById(containerId);
  if (!pg) return;

  pg.innerHTML = `
    <button class="btn btn-sm btn-secondary" ${pagina <= 1 ? 'disabled' : ''} id="pg-prev">‹</button>
    <span class="page-info">${pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${pagina >= pages ? 'disabled' : ''} id="pg-next">›</button>`;

  pg.querySelector('#pg-prev')?.addEventListener('click', () => onPage(pagina - 1));
  pg.querySelector('#pg-next')?.addEventListener('click', () => onPage(pagina + 1));
}

// ── Modal genérico ─────────────────────────────────────────
export function criarModal({ titulo, bodyHtml, acoes = [], wide = false, extraClass = '' }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const acoesHtml = acoes.map(a =>
    `<button class="btn ${a.class || 'btn-secondary'}" id="modal-action-${a.id}">
      ${a.icon ? `<span class="material-symbols-rounded">${a.icon}</span>` : ''} ${a.label}
    </button>`
  ).join('');

  backdrop.innerHTML = `
    <div class="modal ${wide ? 'modal-lg' : ''} ${extraClass}">
      <div class="modal-header">
        <h2>${titulo}</h2>
        <button class="btn-icon" id="modal-close-btn">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
        ${acoesHtml}
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const fechar = () => backdrop.remove();
  backdrop.querySelector('#modal-close-btn').addEventListener('click', fechar);
  backdrop.querySelector('#modal-cancel-btn').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { fechar(); document.removeEventListener('keydown', esc); }
  });

  // Registrar callbacks de ações
  acoes.forEach(a => {
    backdrop.querySelector(`#modal-action-${a.id}`)
      ?.addEventListener('click', () => a.onClick(fechar));
  });

  return { fechar, backdrop };
}

// ── Tratamento de erros Supabase ───────────────────────────
export function traduzirErro(error) {
  if (!error) return 'Erro desconhecido';
  const msg = error.message || '';
  const code = error.code || '';

  if (code === '23505' || msg.includes('duplicate') || msg.includes('unique'))
    return 'Registro duplicado — verifique se já existe um cadastro com esses dados.';
  if (code === '42501' || msg.includes('permission') || msg.includes('policy'))
    return 'Permissão negada — você não tem acesso a esta ação.';
  if (code === '23503' || msg.includes('foreign key'))
    return 'Este registro não pode ser removido pois está vinculado a outros dados.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Falha de conexão — verifique sua internet.';
  if (msg.includes('JWT') || msg.includes('token'))
    return 'Sessão expirada — faça login novamente.';

  return msg || 'Ocorreu um erro inesperado.';
}

// ── Event delegation seguro (substitui window.*) ──────────
// Uso: delegarAcoes(container, { 'editar': (id) => ..., 'deletar': (id) => ... })
export function delegarAcoes(container, handlers) {
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const extra = btn.dataset.extra;
    if (handlers[action]) handlers[action](id, extra, btn);
  });
}

// ── Confirmar ação destrutiva ──────────────────────────────
export function confirmar(msg) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h2><span class="material-symbols-rounded" style="color:var(--warning);vertical-align:middle">warning</span> Confirmar</h2>
        </div>
        <div class="modal-body">
          <p style="font-size:15px;line-height:1.6">${msg}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="c-nao">Cancelar</button>
          <button class="btn btn-danger" id="c-sim">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#c-sim').onclick = () => { backdrop.remove(); resolve(true); };
    backdrop.querySelector('#c-nao').onclick = () => { backdrop.remove(); resolve(false); };
    backdrop.addEventListener('click', e => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
  });
}

// ── Gerar QR Code SVG simples (via API pública) ────────────
export function gerarQRCodeUrl(texto, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(texto)}&bgcolor=0a0f1a&color=00d4ff&margin=2`;
}

// ── Exportar CSV ───────────────────────────────────────────
export function exportarCSV(data, campos, cabecalhos, nomeArquivo) {
  const rows = [cabecalhos.join(';')];
  data.forEach(row => rows.push(campos.map(c => {
    const v = row[c];
    if (v == null) return '';
    return String(v).replace(/;/g, ',').replace(/\n/g, ' ');
  }).join(';')));
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nomeArquivo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── Skeleton loader ────────────────────────────────────────
export function skeletonTabela(cols = 5, rows = 6) {
  const cells = Array(cols).fill('<td><div class="skeleton skeleton-text"></div></td>').join('');
  const rowsHtml = Array(rows).fill(`<tr>${cells}</tr>`).join('');
  return `<table><tbody>${rowsHtml}</tbody></table>`;
}

// ── Formatar dias ──────────────────────────────────────────
export function formatarDias(dias) {
  if (dias == null) return '—';
  const n = Number(dias);
  if (n > 0) return `${n}d vencido`;
  if (n === 0) return 'Vence hoje';
  return `${Math.abs(n)}d restantes`;
}
