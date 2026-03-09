// modules/configuracoes.js — Configurações do sistema
import { supabase, mostrarToast, AppState } from '../js/app.js';
import { escapeHtml, traduzirErro } from '../js/utils.js';
import { setConfig, getConfig, limparCacheConfig } from '../js/supabase.js';

export async function renderConfiguracoes() {
  document.getElementById('topbar-title').textContent = 'Configurações';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>CONFIGURAÇÕES</h1><p>Personalização do sistema</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div class="card" id="card-escola">
        <div class="card-header"><span class="card-title">🏫 DADOS DA ESCOLA</span></div>
        <div class="form-grid">
          <div class="form-group full"><label>Nome da Escola</label><input id="cfg-nome-escola" placeholder="Ex: HLV Treinamentos"/></div>
          <div class="form-group full"><label>CNPJ</label><input id="cfg-cnpj" placeholder="00.000.000/0000-00"/></div>
          <div class="form-group full"><label>Endereço</label><input id="cfg-endereco" placeholder="Rua, número, cidade/UF"/></div>
          <div class="form-group full"><label>Telefone</label><input id="cfg-telefone" placeholder="(11) 99999-9999"/></div>
          <div class="form-group full"><label>E-mail</label><input type="email" id="cfg-email" placeholder="contato@escola.com.br"/></div>
          <div class="form-group full"><label>Site</label><input type="url" id="cfg-site" placeholder="https://escola.com.br"/></div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary" id="btn-salvar-escola"><span class="material-symbols-rounded">save</span> Salvar Dados</button>
        </div>
      </div>
      <div class="card" id="card-cert">
        <div class="card-header"><span class="card-title">📜 CERTIFICADOS</span></div>
        <div class="form-grid">
          <div class="form-group full"><label>Assinante (nome no certificado)</label><input id="cfg-assinante" placeholder="Ex: João Silva — Diretor Técnico"/></div>
          <div class="form-group full"><label>Cargo do Assinante</label><input id="cfg-cargo-assinante" placeholder="Ex: Diretor Técnico"/></div>
          <div class="form-group full"><label>Texto Complementar</label><textarea id="cfg-texto-cert" placeholder="Texto adicional que aparece no certificado..."></textarea></div>
          <div class="form-group full"><label>URL de Verificação Pública</label><input id="cfg-url-verificacao" placeholder="https://seusite.com/verificar"/></div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary" id="btn-salvar-cert"><span class="material-symbols-rounded">save</span> Salvar Certificado</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">👥 USUÁRIOS DO SISTEMA</span></div>
        <div id="tabela-usuarios-wrap">
          <div class="empty-state"><div class="spinner"></div><p>Carregando...</p></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📊 INFORMAÇÕES DO SISTEMA</span></div>
        <div id="info-sistema" style="display:grid;gap:12px;padding:4px"></div>
      </div>
    </div>`;

  await Promise.all([carregarConfigs(), carregarUsuarios(), carregarInfoSistema()]);
  configurarEventos();
}

async function carregarConfigs() {
  const campos = ['nome_escola','cnpj','endereco','telefone','email','site','assinante_cert','cargo_assinante','texto_cert','url_verificacao'];
  const ids = ['cfg-nome-escola','cfg-cnpj','cfg-endereco','cfg-telefone','cfg-email','cfg-site','cfg-assinante','cfg-cargo-assinante','cfg-texto-cert','cfg-url-verificacao'];
  for (let i = 0; i < campos.length; i++) {
    const val = await getConfig(campos[i], '');
    const el = document.getElementById(ids[i]);
    if (el) el.value = val;
  }
}

async function carregarUsuarios() {
  const { data } = await supabase.from('perfis').select('*').eq('ativo', true).order('nome');
  const wrap = document.getElementById('tabela-usuarios-wrap');
  if (!data?.length) { wrap.innerHTML = '<p class="text-muted text-sm">Sem usuários</p>'; return; }
  wrap.innerHTML = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ação</th></tr></thead>
    <tbody>${data.map(u => `<tr>
      <td>${escapeHtml(u.nome)}</td>
      <td class="text-sm text-muted">${escapeHtml(u.email)}</td>
      <td>
        <select class="perfil-select" data-uid="${u.id}" style="padding:4px 8px;background:var(--bg-overlay);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-primary)">
          <option value="admin" ${u.perfil==='admin'?'selected':''}>Admin</option>
          <option value="comercial" ${u.perfil==='comercial'?'selected':''}>Comercial</option>
          <option value="instrutor" ${u.perfil==='instrutor'?'selected':''}>Instrutor</option>
          <option value="aluno" ${u.perfil==='aluno'?'selected':''}>Aluno</option>
        </select>
      </td>
      <td><button class="btn btn-sm btn-secondary btn-salvar-perfil" data-uid="${u.id}">Salvar</button></td>
    </tr>`).join('')}</tbody></table>`;

  wrap.querySelectorAll('.btn-salvar-perfil').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const novoPerfil = wrap.querySelector(`.perfil-select[data-uid="${uid}"]`).value;
      try {
        await supabase.from('perfis').update({ perfil: novoPerfil }).eq('id', uid);
        mostrarToast('Perfil atualizado!', 'success');
      } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
    });
  });
}

async function carregarInfoSistema() {
  const [alunos, turmas, certs, pagamentos] = await Promise.all([
    supabase.from('alunos').select('*', { count: 'exact', head: true }),
    supabase.from('turmas').select('*', { count: 'exact', head: true }),
    supabase.from('certificados').select('*', { count: 'exact', head: true }),
    supabase.from('pagamentos').select('valor_recebido').eq('status', 'recebido'),
  ]);
  const totalRec = (pagamentos.data||[]).reduce((s, p) => s + Number(p.valor_recebido||0), 0);
  document.getElementById('info-sistema').innerHTML = [
    ['group', 'Total de Alunos', alunos.count ?? 0, 'var(--accent)'],
    ['calendar_month', 'Total de Turmas', turmas.count ?? 0, 'var(--info)'],
    ['workspace_premium', 'Certificados Emitidos', certs.count ?? 0, 'var(--success)'],
    ['payments', 'Receita Total', 'R$ ' + totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 'var(--warning)'],
  ].map(([icon, label, val, cor]) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-overlay);border-radius:8px">
      <span class="material-symbols-rounded" style="color:${cor};font-size:24px">${icon}</span>
      <div>
        <div class="text-xs text-muted">${label}</div>
        <div style="font-size:16px;font-weight:700;color:${cor}">${val}</div>
      </div>
    </div>`).join('');
}

function configurarEventos() {
  document.getElementById('btn-salvar-escola').addEventListener('click', async () => {
    const map = {
      'nome_escola': '#cfg-nome-escola', 'cnpj': '#cfg-cnpj',
      'endereco': '#cfg-endereco', 'telefone': '#cfg-telefone',
      'email': '#cfg-email', 'site': '#cfg-site',
    };
    try {
      for (const [chave, id] of Object.entries(map)) {
        await setConfig(chave, document.querySelector(id).value.trim());
      }
      limparCacheConfig();
      mostrarToast('Dados da escola salvos! Recarregue para ver o nome atualizado.', 'success');
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });

  document.getElementById('btn-salvar-cert').addEventListener('click', async () => {
    const map = {
      'assinante_cert': '#cfg-assinante', 'cargo_assinante': '#cfg-cargo-assinante',
      'texto_cert': '#cfg-texto-cert', 'url_verificacao': '#cfg-url-verificacao',
    };
    try {
      for (const [chave, id] of Object.entries(map)) {
        await setConfig(chave, document.querySelector(id).value.trim());
      }
      mostrarToast('Configurações de certificado salvas!', 'success');
    } catch (e) { mostrarToast(traduzirErro(e), 'error'); }
  });
}
