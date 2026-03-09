// modules/configuracoes.js v2 — White-label, tema dinâmico, gestão de usuários
import { supabase, mostrarToast, AppState } from '../js/app.js';
import { escapeHtml, traduzirErro, confirmar } from '../js/utils.js';
import { setConfig, getConfig, limparCacheConfig } from '../js/supabase.js';
import { aplicarTema, getTema, PALETAS } from '../js/theme.js';

export async function renderConfiguracoes() {
  document.getElementById('topbar-title').textContent = 'Configurações';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>CONFIGURAÇÕES</h1><p>White-label, tema e sistema</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

      <!-- DADOS DA ESCOLA -->
      <div class="card">
        <div class="card-header"><span class="card-title">🏫 DADOS DA ESCOLA</span></div>
        <div class="form-grid" style="gap:12px">
          <div class="form-group full"><label>Nome da Escola *</label><input id="cfg-nome-escola" placeholder="Ex: HLV Treinamentos"/></div>
          <div class="form-group full"><label>CNPJ</label><input id="cfg-cnpj" placeholder="00.000.000/0000-00"/></div>
          <div class="form-group full"><label>Endereço</label><input id="cfg-endereco" placeholder="Rua, número, cidade/UF"/></div>
          <div class="form-group"><label>Telefone</label><input id="cfg-telefone" placeholder="(11) 99999-9999"/></div>
          <div class="form-group"><label>E-mail</label><input type="email" id="cfg-email"/></div>
          <div class="form-group full"><label>Site</label><input type="url" id="cfg-site" placeholder="https://"/></div>
          <div class="form-group full"><label>Logotipo da Escola</label>
            <input id="cfg-logo-url" placeholder="https://seusite.com/logo.png"/>
            <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
              <label for="cfg-logo-upload" class="btn btn-sm btn-secondary" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px">
                <span class="material-symbols-rounded" style="font-size:14px">upload</span> Enviar Arquivo
              </label>
              <input type="file" id="cfg-logo-upload" accept="image/*" style="display:none"/>
              <span style="font-size:11px;color:var(--text-tertiary)">PNG, SVG, JPG recomendados</span>
            </div>
            <div id="logo-preview" style="margin-top:8px;min-height:40px"></div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-salvar-escola" style="margin-top:16px">
          <span class="material-symbols-rounded">save</span> Salvar Dados
        </button>
      </div>

      <!-- IDENTIDADE VISUAL -->
      <div class="card">
        <div class="card-header"><span class="card-title">🎨 IDENTIDADE VISUAL</span></div>

        <div style="margin-bottom:16px">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:8px">PALETAS PRÉ-DEFINIDAS</label>
          <div id="paletas-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
        </div>

        <div style="height:1px;background:var(--border-default);margin:16px 0"></div>

        <div class="form-grid" style="gap:12px">
          <div class="form-group">
            <label>Cor Primária (accent)</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" id="cfg-cor-primaria" style="width:48px;height:36px;padding:2px;border-radius:6px;cursor:pointer;border:1px solid var(--border-default)"/>
              <input id="cfg-cor-primaria-hex" placeholder="#00d4ff" style="flex:1;font-family:var(--font-mono)"/>
            </div>
          </div>
          <div class="form-group">
            <label>Cor Secundária</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" id="cfg-cor-sec" style="width:48px;height:36px;padding:2px;border-radius:6px;cursor:pointer;border:1px solid var(--border-default)"/>
              <input id="cfg-cor-sec-hex" placeholder="#7c3aed" style="flex:1;font-family:var(--font-mono)"/>
            </div>
          </div>
          <div class="form-group">
            <label>Modo</label>
            <select id="cfg-modo">
              <option value="dark">🌙 Escuro</option>
              <option value="light">☀️ Claro</option>
            </select>
          </div>
          <div class="form-group">
            <label>Raio de Borda (px)</label>
            <input type="range" id="cfg-raio" min="0" max="20" step="2" style="width:100%;accent-color:var(--accent)"/>
            <div style="text-align:center;font-size:11px;color:var(--text-muted)" id="raio-label">8px</div>
          </div>
        </div>

        <!-- Preview -->
        <div id="tema-preview" style="border:1px solid var(--border-default);border-radius:var(--radius-md);padding:12px;margin-top:12px">
          <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:8px">PREVIEW</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="prev-btn-primary" class="btn btn-sm btn-primary">Botão Primário</button>
            <span id="prev-badge" class="badge" style="background:var(--accent-dim);color:var(--accent)">Badge</span>
            <span id="prev-link" style="color:var(--accent);font-size:13px;cursor:pointer">Link de exemplo</span>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-salvar-tema" style="margin-top:16px">
          <span class="material-symbols-rounded">palette</span> Aplicar e Salvar Tema
        </button>
      </div>

      <!-- CERTIFICADOS -->
      <div class="card">
        <div class="card-header"><span class="card-title">📜 CONFIGURAÇÕES DO CERTIFICADO</span></div>
        <div class="form-grid" style="gap:12px">
          <div class="form-group full"><label>Assinante (nome no certificado)</label><input id="cfg-assinante" placeholder="Ex: João Silva"/></div>
          <div class="form-group full"><label>Cargo do Assinante</label><input id="cfg-cargo-assinante" placeholder="Ex: Diretor Técnico"/></div>
          <div class="form-group full"><label>Texto Complementar</label><textarea id="cfg-texto-cert" placeholder="Texto adicional que aparece no certificado..." rows="3"></textarea></div>
          <div class="form-group full"><label>URL de Verificação Pública</label>
            <input id="cfg-url-verificacao" placeholder="https://seusite.com/verificar"/>
            <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">Esta URL + o código do certificado geram o QR Code</div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-salvar-cert" style="margin-top:16px">
          <span class="material-symbols-rounded">save</span> Salvar Configurações
        </button>
      </div>

      <!-- USUÁRIOS -->
      <div class="card">
        <div class="card-header"><span class="card-title">👥 USUÁRIOS DO SISTEMA</span></div>
        <div id="tabela-usuarios-wrap">
          <div class="skeleton skeleton-text" style="margin:8px 0"></div>
          <div class="skeleton skeleton-text" style="margin:8px 0;width:80%"></div>
        </div>
      </div>

    </div>`;

  await Promise.all([carregarConfigs(), carregarUsuarios(), renderPaletas()]);
  configurarEventosTema();
  configurarEventosSalvar();
}

async function carregarConfigs() {
  const campos = {
    'nome_escola':      '#cfg-nome-escola',
    'cnpj':             '#cfg-cnpj',
    'endereco':         '#cfg-endereco',
    'telefone':         '#cfg-telefone',
    'email':            '#cfg-email',
    'site':             '#cfg-site',
    'logo_url':         '#cfg-logo-url',
    'assinante_cert':   '#cfg-assinante',
    'cargo_assinante':  '#cfg-cargo-assinante',
    'texto_cert':       '#cfg-texto-cert',
    'url_verificacao':  '#cfg-url-verificacao',
    'cor_primaria':     null,
    'cor_secundaria':   null,
    'modo_tema':        null,
    'raio_borda':       null,
  };

  for (const [chave] of Object.entries(campos)) {
    const val = await getConfig(chave, '');
    const sel = campos[chave];
    if (sel) {
      const el = document.querySelector(sel);
      if (el) el.value = val;
    }
    // Tema
    if (chave === 'cor_primaria' && val) {
      document.querySelector('#cfg-cor-primaria').value = val;
      document.querySelector('#cfg-cor-primaria-hex').value = val;
    }
    if (chave === 'cor_secundaria' && val) {
      document.querySelector('#cfg-cor-sec').value = val;
      document.querySelector('#cfg-cor-sec-hex').value = val;
    }
    if (chave === 'modo_tema' && val) document.querySelector('#cfg-modo').value = val;
    if (chave === 'raio_borda' && val) {
      document.querySelector('#cfg-raio').value = val;
      document.querySelector('#raio-label').textContent = val + 'px';
    }
  }

  // Preview do logo
  const logoUrl = document.querySelector('#cfg-logo-url').value;
  atualizarPreviewLogo(logoUrl);
}

function atualizarPreviewLogo(url) {
  const prev = document.getElementById('logo-preview');
  if (!prev) return;
  if (url) {
    prev.innerHTML = `<img src="${escapeHtml(url)}" style="max-height:50px;max-width:200px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'"/>`;
  } else {
    prev.innerHTML = '';
  }
}

function renderPaletas() {
  const grid = document.getElementById('paletas-grid');
  grid.innerHTML = PALETAS.map(p => `
    <button class="paleta-btn" data-paleta='${JSON.stringify(p).replace(/'/g,"\\'")}' style="
      display:flex;align-items:center;gap:8px;padding:8px 10px;
      background:var(--bg-overlay);border:1px solid var(--border-subtle);
      border-radius:var(--radius-sm);cursor:pointer;text-align:left;font-size:11px;color:var(--text-secondary)">
      <div style="width:16px;height:16px;border-radius:50%;background:${escapeHtml(p.cor_primaria)};flex-shrink:0"></div>
      ${escapeHtml(p.nome)}
    </button>`).join('');

  grid.querySelectorAll('.paleta-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = JSON.parse(btn.dataset.paleta);
      document.querySelector('#cfg-cor-primaria').value = p.cor_primaria;
      document.querySelector('#cfg-cor-primaria-hex').value = p.cor_primaria;
      document.querySelector('#cfg-cor-sec').value = p.cor_secundaria;
      document.querySelector('#cfg-cor-sec-hex').value = p.cor_secundaria;
      document.querySelector('#cfg-modo').value = p.modo;
      aplicarTema(p);
    });
  });
}

function configurarEventosTema() {
  const corPick = document.querySelector('#cfg-cor-primaria');
  const corHex  = document.querySelector('#cfg-cor-primaria-hex');
  const secPick = document.querySelector('#cfg-cor-sec');
  const secHex  = document.querySelector('#cfg-cor-sec-hex');
  const raio    = document.querySelector('#cfg-raio');

  corPick.addEventListener('input', () => { corHex.value = corPick.value; previewTema(); });
  corHex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(corHex.value)) { corPick.value = corHex.value; previewTema(); } });
  secPick.addEventListener('input', () => { secHex.value = secPick.value; });
  secHex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(secHex.value)) secPick.value = secHex.value; });
  raio.addEventListener('input', () => { document.querySelector('#raio-label').textContent = raio.value + 'px'; previewTema(); });
  document.querySelector('#cfg-logo-url').addEventListener('blur', e => atualizarPreviewLogo(e.target.value));

  // Upload de arquivo de logo → converte para base64 / data URL
  document.querySelector('#cfg-logo-upload').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { mostrarToast('Logo muito grande. Use uma imagem menor que 500KB.', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      document.querySelector('#cfg-logo-url').value = dataUrl;
      atualizarPreviewLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  });
}

function previewTema() {
  const cor = document.querySelector('#cfg-cor-primaria').value || '#00d4ff';
  const raio = document.querySelector('#cfg-raio').value || 8;
  aplicarTema({ cor_primaria: cor, raio_borda: raio, modo: document.querySelector('#cfg-modo').value });
}

function configurarEventosSalvar() {
  document.getElementById('btn-salvar-escola').addEventListener('click', async () => {
    const campos = {
      'nome_escola': '#cfg-nome-escola', 'cnpj': '#cfg-cnpj',
      'endereco': '#cfg-endereco', 'telefone': '#cfg-telefone',
      'email': '#cfg-email', 'site': '#cfg-site', 'logo_url': '#cfg-logo-url',
    };
    try {
      for (const [k, sel] of Object.entries(campos)) await setConfig(k, document.querySelector(sel).value.trim());
      limparCacheConfig();
      // Atualizar nome da escola na sidebar
      const nomeEl = document.querySelector('.brand-name');
      if (nomeEl) nomeEl.textContent = document.querySelector('#cfg-nome-escola').value.trim() || 'TrainOS';
      mostrarToast('Dados da escola salvos!', 'success');
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });

  document.getElementById('btn-salvar-tema').addEventListener('click', async () => {
    const cor = document.querySelector('#cfg-cor-primaria').value;
    const sec = document.querySelector('#cfg-cor-sec').value;
    const modo = document.querySelector('#cfg-modo').value;
    const raio = document.querySelector('#cfg-raio').value;
    try {
      await Promise.all([
        setConfig('cor_primaria', cor), setConfig('cor_secundaria', sec),
        setConfig('modo_tema', modo), setConfig('raio_borda', raio),
      ]);
      aplicarTema({ cor_primaria: cor, cor_secundaria: sec, modo, raio_borda: raio });
      mostrarToast('Tema aplicado e salvo!', 'success');
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });

  document.getElementById('btn-salvar-cert').addEventListener('click', async () => {
    const campos = {
      'assinante_cert': '#cfg-assinante', 'cargo_assinante': '#cfg-cargo-assinante',
      'texto_cert': '#cfg-texto-cert', 'url_verificacao': '#cfg-url-verificacao',
    };
    try {
      for (const [k, sel] of Object.entries(campos)) await setConfig(k, document.querySelector(sel).value.trim());
      mostrarToast('Configurações do certificado salvas!', 'success');
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });
}

async function carregarUsuarios() {
  const { data } = await supabase.from('perfis').select('*').eq('ativo', true).order('nome');
  const wrap = document.getElementById('tabela-usuarios-wrap');
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted text-sm">Sem usuários</p>'; return; }
  wrap.innerHTML = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th></th></tr></thead>
    <tbody>${data.map(u => `<tr>
      <td>${escapeHtml(u.nome)}</td>
      <td class="text-sm text-muted">${escapeHtml(u.email)}</td>
      <td><select class="perfil-sel" data-uid="${u.id}" style="padding:4px 8px;background:var(--bg-overlay);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-primary)">
        <option value="admin" ${u.perfil==='admin'?'selected':''}>Admin</option>
        <option value="comercial" ${u.perfil==='comercial'?'selected':''}>Comercial</option>
        <option value="instrutor" ${u.perfil==='instrutor'?'selected':''}>Instrutor</option>
        <option value="aluno" ${u.perfil==='aluno'?'selected':''}>Aluno</option>
      </select></td>
      <td><button class="btn btn-sm btn-secondary btn-salvar-perfil" data-uid="${u.id}">Salvar</button></td>
    </tr>`).join('')}</tbody></table>`;

  wrap.querySelectorAll('.btn-salvar-perfil').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const perfil = wrap.querySelector(`.perfil-sel[data-uid="${uid}"]`).value;
      try {
        await supabase.from('perfis').update({ perfil }).eq('id', uid);
        mostrarToast('Perfil atualizado!', 'success');
      } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
    });
  });
}
