// modules/certificados.js v3 — PDF corrigido, QR Code, White-label
import { supabase, mostrarToast } from '../js/app.js';
import { fmtData, debounce, emptyState, renderStatCards, renderPaginacao, delegarAcoes, escapeHtml, traduzirErro } from '../js/utils.js';
import { getTema, gerarCSSCertificado } from '../js/theme.js';
import { abrirModalWhatsApp } from '../js/whatsapp.js';
import { getConfig } from '../js/supabase.js';

let state = { pagina: 1, busca: '', filtroStatus: '' };
const PAGE_SIZE = 25;

export async function renderCertificados() {
  document.getElementById('topbar-title').textContent = 'Certificados';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>CERTIFICADOS</h1><p>Emissão, QR Code e comunicação</p></div>
    </div>
    <div class="stats-grid" id="stats-cert"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-cert" placeholder="Buscar por aluno, curso ou código..."/></div>
        <select id="filtro-cert-status" style="width:160px">
          <option value="">Todos</option>
          <option value="valido">Válidos</option>
          <option value="a_vencer_60d">A Vencer (60d)</option>
          <option value="vencido">Vencidos</option>
          <option value="sem_validade">Sem Validade</option>
        </select>
      </div>
      <div id="tabela-cert-wrap"></div>
      <div class="table-footer">
        <span id="info-cert" class="text-muted text-sm"></span>
        <div class="pagination" id="pag-cert"></div>
      </div>
    </div>`;

  document.getElementById('busca-cert').addEventListener('input', debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }));
  document.getElementById('filtro-cert-status').addEventListener('change', e => { state.filtroStatus = e.target.value; state.pagina = 1; carregar(); });

  delegarAcoes(document.getElementById('tabela-cert-wrap'), {
    'pdf':      id => gerarPDF(id),
    'whatsapp': (id, extra) => enviarWhatsAppCert(id, extra),
  });

  await Promise.all([carregar(), carregarStats()]);
}

async function carregarStats() {
  const hoje = new Date().toISOString().split('T')[0];
  const em60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const [total, validos, aVencer, vencidos] = await Promise.all([
    supabase.from('certificados').select('*', { count: 'exact', head: true }),
    supabase.from('certificados').select('*', { count: 'exact', head: true }).gt('data_validade', hoje),
    supabase.from('certificados').select('*', { count: 'exact', head: true }).lte('data_validade', em60).gt('data_validade', hoje),
    supabase.from('certificados').select('*', { count: 'exact', head: true }).lte('data_validade', hoje),
  ]);
  renderStatCards('stats-cert', [
    { icon: 'workspace_premium', label: 'Total Emitidos', value: total.count ?? 0, cor: 'var(--accent)' },
    { icon: 'verified',          label: 'Válidos',        value: validos.count ?? 0,  cor: 'var(--success)' },
    { icon: 'schedule',          label: 'A Vencer (60d)', value: aVencer.count ?? 0,  cor: 'var(--warning)' },
    { icon: 'running_with_errors',label:'Vencidos',       value: vencidos.count ?? 0, cor: 'var(--danger)' },
  ]);
}

async function carregar() {
  const from = (state.pagina - 1) * PAGE_SIZE;
  let q = supabase.from('vw_pipeline_operacional')
    .select('*', { count: 'exact' })
    .not('certificado_codigo', 'is', null)
    .order('cert_emissao', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (state.busca) q = q.or(`aluno_nome.ilike.%${state.busca}%,curso_nome.ilike.%${state.busca}%,certificado_codigo.ilike.%${state.busca}%`);
  if (state.filtroStatus) q = q.eq('status_certificado', state.filtroStatus);
  const { data, error, count } = await q;
  if (error) { mostrarToast(traduzirErro(error), 'error'); return; }
  renderTabela(data);
  renderPaginacao({ containerId: 'pag-cert', infoId: 'info-cert', pagina: state.pagina, total: count, pageSize: PAGE_SIZE, label: 'certificados', onPage: p => { state.pagina = p; carregar(); } });
}

const certStatusConfig = {
  valido:       { badge: 'badge-success', label: 'Válido' },
  a_vencer_60d: { badge: 'badge-warning', label: 'A Vencer' },
  vencido:      { badge: 'badge-danger',  label: 'Vencido' },
  sem_validade: { badge: 'badge-neutral', label: 'Sem Validade' },
};

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-cert-wrap');
  if (!rows?.length) { wrap.innerHTML = emptyState('workspace_premium', 'Nenhum certificado encontrado'); return; }
  wrap.innerHTML = `<table><thead><tr>
    <th>Aluno</th><th>Curso</th><th>Código</th><th>Emissão</th><th>Validade</th><th>Status</th><th>Ações</th>
  </tr></thead><tbody>
    ${rows.map(c => {
      const sc = certStatusConfig[c.status_certificado] || { badge: 'badge-neutral', label: c.status_certificado || '—' };
      const hoje = new Date();
      const diasRestantes = c.cert_validade ? Math.floor((new Date(c.cert_validade) - hoje) / 86400000) : null;
      return `<tr>
        <td><strong>${escapeHtml(c.aluno_nome)}</strong></td>
        <td class="text-sm">${escapeHtml(c.curso_nome)}</td>
        <td class="mono text-sm" style="color:var(--accent)">${escapeHtml(c.certificado_codigo)}</td>
        <td class="text-sm">${fmtData(c.cert_emissao)}</td>
        <td class="text-sm">
          ${c.cert_validade ? fmtData(c.cert_validade) : '<span class="text-muted">—</span>'}
          ${diasRestantes !== null ? `<br><span class="text-xs ${diasRestantes < 0 ? 'text-danger' : diasRestantes < 60 ? 'text-warning' : 'text-muted'}">${diasRestantes < 0 ? Math.abs(diasRestantes) + 'd vencido' : diasRestantes + 'd restantes'}</span>` : ''}
        </td>
        <td><span class="badge ${sc.badge}">${sc.label}</span></td>
        <td><div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" data-action="pdf" data-id="${c.matricula_id}" title="Gerar PDF com QR Code">
            <span class="material-symbols-rounded" style="font-size:14px">picture_as_pdf</span> PDF
          </button>
          <button class="btn btn-sm" data-action="whatsapp" data-id="${c.matricula_id}" data-extra="${escapeHtml(c.aluno_whatsapp||c.aluno_telefone||'')}" title="Enviar por WhatsApp"
            style="background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.3);color:#25d366">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366" style="vertical-align:middle"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WA
          </button>
        </div></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

// ── Gerar PDF com QR Code e white-label ──────────────────────────────────────
async function gerarPDF(matriculaId) {
  mostrarToast('Gerando certificado...', 'info', 2000);

  // 1. Buscar certificado pela matricula_id
  const { data: cert, error: certErr } = await supabase
    .from('certificados')
    .select('*')
    .eq('matricula_id', matriculaId)
    .single();

  if (certErr || !cert) {
    mostrarToast('Certificado não encontrado. Verifique se foi emitido corretamente.', 'error');
    console.error('[PDF] Erro ao buscar certificado:', certErr);
    return;
  }

  // 2. Buscar dados relacionados em paralelo
  const [alunoRes, cursoRes] = await Promise.all([
    supabase.from('alunos').select('nome, cpf, whatsapp, telefone').eq('id', cert.aluno_id).single(),
    supabase.from('cursos').select('nome, carga_horaria_horas, norma_regulamentadora').eq('id', cert.curso_id).single(),
  ]);

  const aluno = alunoRes.data;
  const curso = cursoRes.data;

  if (!aluno || !curso) {
    mostrarToast('Dados do aluno ou curso não encontrados.', 'error');
    return;
  }

  // 3. Buscar turma (opcional)
  let turma = null;
  if (cert.turma_id) {
    const { data: t } = await supabase
      .from('turmas')
      .select('data_inicio, data_fim, local')
      .eq('id', cert.turma_id)
      .single();
    turma = t;
  }

  // 4. Nome do instrutor
  let instrutorNome = cert.instrutor_nome || '';
  if (!instrutorNome && cert.turma_id) {
    const { data: tm } = await supabase
      .from('turmas')
      .select('instrutor_id, instrutores(nome)')
      .eq('id', cert.turma_id)
      .single();
    instrutorNome = tm?.instrutores?.nome || '';
  }

  // 5. Configurações white-label
  const [nomeEscola, assinante, cargoAssinante, textoCert, urlVerificacao, logoUrl, cnpj, enderecoEscola] = await Promise.all([
    getConfig('nome_escola', 'TrainOS'),
    getConfig('assinante_cert', 'Diretor Técnico'),
    getConfig('cargo_assinante', 'Diretor Técnico'),
    getConfig('texto_cert', ''),
    getConfig('url_verificacao', ''),
    getConfig('logo_url', ''),
    getConfig('cnpj', ''),
    getConfig('endereco', ''),
  ]);

  const tema = getTema();
  const cores = gerarCSSCertificado();

  // 6. QR Code — URL de verificação pública
  const baseUrl = (urlVerificacao || window.location.origin + '/verificar').replace(/\/$/, '');
  const urlCompleta = `${baseUrl}?codigo=${encodeURIComponent(cert.codigo_verificacao)}`;

  // QR via api.qrserver.com (gratuito, sem chave de API)
  const qrFgColor = tema.cor_primaria.replace('#', '');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(urlCompleta)}&color=${qrFgColor}&bgcolor=ffffff&margin=4&format=png&ecc=M`;

  // 7. Gerar e abrir HTML
  const htmlCert = gerarHTMLCertificado(cert, aluno, curso, turma, {
    nomeEscola, assinante, cargoAssinante, textoCert,
    urlCompleta, logoUrl, qrUrl, cores, tema,
    cnpj, enderecoEscola, instrutorNome,
  });

  const win = window.open('', '_blank');
  if (!win) {
    mostrarToast('Pop-ups bloqueados. Habilite-os para gerar o PDF.', 'warning');
    return;
  }
  win.document.write(htmlCert);
  win.document.close();
  win.focus();
  // Aguarda fontes e imagem do QR carregarem antes de acionar o print
  win.addEventListener('load', () => setTimeout(() => win.print(), 600));
  setTimeout(() => { try { win.print(); } catch(e) {} }, 1500);
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function gerarHTMLCertificado(cert, aluno, curso, turma, opts) {
  const { nomeEscola, assinante, cargoAssinante, textoCert, urlCompleta, logoUrl, qrUrl, cores, tema, cnpj, enderecoEscola, instrutorNome } = opts;

  const dataEmissao  = fmtData(cert.data_emissao);
  const dataValidade = cert.data_validade ? fmtData(cert.data_validade) : null;
  const periodo      = turma ? `${fmtData(turma.data_inicio)} a ${fmtData(turma.data_fim)}` : dataEmissao;
  const local        = turma?.local || '';

  const accent  = tema.cor_primaria  || '#00d4ff';
  const sec     = tema.cor_secundaria || accent;
  const isDark  = tema.modo !== 'light';
  const bgCert  = isDark ? (tema.cor_fundo || '#0a0f1a') : '#ffffff';
  const txtMain = isDark ? '#e6edf3' : '#1a1a2e';
  const muted   = isDark ? 'rgba(230,237,243,0.5)' : '#6c757d';
  const nomeColor = isDark ? '#ffffff' : '#1a1a2e';

  const logoTag = logoUrl
    ? `<img src="${escHtml(logoUrl)}" style="height:14mm;max-width:52mm;object-fit:contain" alt="${escHtml(nomeEscola)}" onerror="this.style.display='none'"/>`
    : `<div style="width:14mm;height:14mm;border-radius:3mm;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18pt;font-weight:700;flex-shrink:0">${escHtml(nomeEscola.charAt(0))}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Certificado — ${escHtml(aluno.nome)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;background:#d0d0d0;font-family:'Inter',sans-serif}
@media print{
  html,body{background:transparent}
  @page{size:A4 landscape;margin:0}
  .no-print{display:none!important}
  .cert{box-shadow:none!important}
  body{padding:0!important}
}
.topbar{
  position:fixed;top:0;left:0;right:0;z-index:999;
  background:#111827;padding:10px 20px;
  display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 2px 12px rgba(0,0,0,0.5);
}
.topbar-title{color:#fff;font-size:13px;font-weight:500}
.topbar-btns{display:flex;gap:8px}
.btn{padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
.btn-primary{background:${accent};color:#fff}
.btn-ghost{background:rgba(255,255,255,0.1);color:#fff}
.btn:hover{opacity:0.85}
.wrap{padding:56px 20px 30px;display:flex;justify-content:center}
/* CERTIFICADO */
.cert{
  width:297mm;height:210mm;
  background:${bgCert};
  position:relative;overflow:hidden;
  box-shadow:0 8px 40px rgba(0,0,0,0.35);
  flex-shrink:0;
}
/* Barras decorativas */
.bar-l{position:absolute;left:0;top:0;bottom:0;width:14mm;background:linear-gradient(180deg,${accent},${sec});z-index:2}
.bar-r{position:absolute;right:0;top:0;bottom:0;width:5mm;background:linear-gradient(180deg,${sec}60,${accent}40);z-index:2}
.bar-t{position:absolute;top:0;left:14mm;right:5mm;height:3mm;background:linear-gradient(90deg,${accent}80,${sec}40);z-index:2}
.bar-b{position:absolute;bottom:0;left:14mm;right:5mm;height:2mm;background:${accent}40;z-index:2}
/* Padrão pontilhado */
.dots{position:absolute;inset:0;z-index:1;background-image:radial-gradient(${accent}10 1.5px,transparent 1.5px);background-size:18mm 18mm}
/* Marca d'água */
.wm{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-22deg);
  font-family:'Playfair Display',serif;font-size:88pt;font-weight:700;
  letter-spacing:10px;color:${accent}05;white-space:nowrap;z-index:1;
  text-transform:uppercase;pointer-events:none;
}
/* Cantos */
.corner{position:absolute;width:20mm;height:20mm;border-color:${accent};border-style:solid;opacity:0.45;z-index:3}
.tl{top:12mm;left:18mm;border-width:2px 0 0 2px}
.tr{top:12mm;right:9mm;border-width:2px 2px 0 0}
.bl{bottom:12mm;left:18mm;border-width:0 0 2px 2px}
.br{bottom:12mm;right:9mm;border-width:0 2px 2px 0}
/* Corpo */
.body{
  position:relative;z-index:4;
  margin:13mm 14mm 11mm 26mm;
  height:calc(210mm - 24mm);
  display:flex;flex-direction:column;
}
/* Cabeçalho */
.hdr{
  display:flex;justify-content:space-between;align-items:flex-start;
  margin-bottom:4mm;padding-bottom:3mm;
  border-bottom:1px solid ${accent}22;
}
.logo-area{display:flex;align-items:center;gap:3mm}
.escola-nome{font-size:10pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${accent}}
.escola-sub{font-size:7pt;color:${muted};letter-spacing:0.5px;margin-top:0.5mm}
.escola-cnpj{font-size:6.5pt;color:${muted};margin-top:0.5mm;font-family:monospace}
.nr-badge{
  background:${accent}15;border:1.5px solid ${accent}45;
  padding:2mm 5mm;border-radius:2mm;
  font-size:9pt;color:${accent};font-weight:700;letter-spacing:1.5px;text-align:center;
}
.nr-label{font-size:6pt;color:${muted};letter-spacing:0.5px;margin-bottom:1mm;text-align:center}
/* Centro */
.center{
  flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;
  padding:0 5mm;
}
.pre-title{font-size:7.5pt;letter-spacing:5px;text-transform:uppercase;color:${muted};margin-bottom:1mm}
.main-title{
  font-family:'Playfair Display',serif;
  font-size:30pt;letter-spacing:6px;text-transform:uppercase;
  color:${accent};line-height:1;margin-bottom:0.5mm;
}
.sub-title{font-size:7pt;letter-spacing:3px;color:${muted};text-transform:uppercase;margin-bottom:5mm}
.confere{font-size:9pt;color:${muted};margin-bottom:2mm}
.nome-aluno{
  font-family:'Playfair Display',serif;
  font-size:24pt;font-style:italic;color:${nomeColor};
  margin-bottom:1mm;display:inline-block;
}
.nome-sep{width:80%;height:1.5px;background:${accent}45;margin:2mm auto 0}
.cpf{font-size:7.5pt;color:${muted};margin-bottom:4mm;letter-spacing:0.5px}
.curso-intro{font-size:8.5pt;color:${muted};margin-bottom:1.5mm;margin-top:4mm}
.curso-nome{
  font-family:'Playfair Display',serif;
  font-size:15pt;color:${accent};margin-bottom:2mm;font-weight:700;
}
.detalhes{font-size:7.5pt;color:${muted};letter-spacing:0.5px}
.txt-extra{font-size:7pt;color:${muted};margin-top:3mm;font-style:italic;max-width:200mm;line-height:1.6}
/* Rodapé */
.footer{
  display:grid;grid-template-columns:1fr auto 1fr;
  align-items:end;gap:10mm;
  padding-top:4mm;border-top:1px solid ${accent}22;
}
.dados-emissao{font-size:7pt;color:${muted};line-height:1.8}
.cod{font-family:monospace;font-size:8.5pt;color:${accent};font-weight:700}
.qr-area{text-align:center}
.qr-img{width:22mm;height:22mm;display:block;margin:0 auto;border:1.5px solid ${accent}30;border-radius:2mm;padding:1mm;background:#fff}
.qr-label{font-size:5.5pt;color:${muted};margin-top:1mm;letter-spacing:0.3px}
.qr-url{font-size:5pt;color:${accent};margin-top:0.5mm;word-break:break-all;max-width:28mm}
.assin{text-align:center}
.assin-linha{width:48mm;height:1px;background:${accent}40;margin:0 auto 2mm}
.assin-nome{font-size:8.5pt;color:${txtMain};font-weight:600}
.assin-cargo{font-size:7pt;color:${muted}}
.assin-escola{font-size:6.5pt;color:${accent};margin-top:0.5mm}
</style>
</head>
<body>
<div class="topbar no-print">
  <span class="topbar-title">📜 Certificado — ${escHtml(aluno.nome)}</span>
  <div class="topbar-btns">
    <button class="btn btn-ghost" onclick="window.close()">✕ Fechar</button>
    <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
</div>
<div class="wrap">
<div class="cert">
  <div class="bar-l"></div>
  <div class="bar-r"></div>
  <div class="bar-t"></div>
  <div class="bar-b"></div>
  <div class="dots"></div>
  <div class="wm">Certificado</div>
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>

  <div class="body">
    <!-- CABEÇALHO -->
    <div class="hdr">
      <div class="logo-area">
        ${logoTag}
        <div>
          <div class="escola-nome">${escHtml(nomeEscola)}</div>
          <div class="escola-sub">Escola de Treinamentos Profissionais</div>
          ${cnpj ? `<div class="escola-cnpj">CNPJ: ${escHtml(cnpj)}</div>` : ''}
          ${enderecoEscola ? `<div class="escola-cnpj">${escHtml(enderecoEscola)}</div>` : ''}
        </div>
      </div>
      ${curso.norma_regulamentadora ? `<div><div class="nr-label">NORMA</div><div class="nr-badge">${escHtml(curso.norma_regulamentadora)}</div></div>` : ''}
    </div>

    <!-- CENTRO -->
    <div class="center">
      <div class="pre-title">certifica que</div>
      <div class="main-title">Certificado</div>
      <div class="sub-title">de Conclusão de Curso</div>
      <div class="confere">O(A) profissional</div>
      <div class="nome-aluno">${escHtml(aluno.nome)}</div>
      <div class="nome-sep"></div>
      ${aluno.cpf ? `<div class="cpf">CPF: ${escHtml(aluno.cpf)}</div>` : '<div style="margin-bottom:4mm"></div>'}
      <div class="curso-intro">concluiu com aproveitamento o curso de</div>
      <div class="curso-nome">${escHtml(curso.nome)}</div>
      <div class="detalhes">
        Carga Horária: <strong>${curso.carga_horaria_horas}h</strong>
        &nbsp;·&nbsp; Período: <strong>${escHtml(periodo)}</strong>
        ${local ? `&nbsp;·&nbsp; Local: <strong>${escHtml(local)}</strong>` : ''}
        ${instrutorNome ? `&nbsp;·&nbsp; Instrutor(a): <strong>${escHtml(instrutorNome)}</strong>` : ''}
      </div>
      ${textoCert ? `<div class="txt-extra">${escHtml(textoCert)}</div>` : ''}
    </div>

    <!-- RODAPÉ -->
    <div class="footer">
      <div class="dados-emissao">
        <div>Código de Verificação:</div>
        <div class="cod">${escHtml(cert.codigo_verificacao)}</div>
        <div style="margin-top:1mm">Emitido em: <strong>${dataEmissao}</strong></div>
        ${dataValidade ? `<div>Válido até: <strong>${dataValidade}</strong></div>` : '<div>Sem data de validade</div>'}
      </div>

      <div class="qr-area">
        <img src="${escHtml(qrUrl)}" class="qr-img" alt="QR Code de autenticidade"/>
        <div class="qr-label">Verificar autenticidade</div>
        <div class="qr-url">${escHtml(urlCompleta)}</div>
      </div>

      <div class="assin">
        <div class="assin-linha"></div>
        <div class="assin-nome">${escHtml(assinante)}</div>
        <div class="assin-cargo">${escHtml(cargoAssinante)}</div>
        <div class="assin-escola">${escHtml(nomeEscola)}</div>
      </div>
    </div>
  </div>
</div>
</div>
</body>
</html>`;
}

// ── Enviar WhatsApp sobre certificado ────────────────────────────────────────
async function enviarWhatsAppCert(matriculaId, numero) {
  const { data: cert } = await supabase
    .from('certificados')
    .select('*, alunos(nome,whatsapp,telefone), cursos(nome)')
    .eq('matricula_id', matriculaId)
    .single();

  if (!cert) { mostrarToast('Certificado não encontrado.', 'error'); return; }

  const [nomeEscola, urlVerificacao] = await Promise.all([
    getConfig('nome_escola', 'TrainOS'),
    getConfig('url_verificacao', ''),
  ]);

  const hoje = new Date();
  const vencido = cert.data_validade && new Date(cert.data_validade) < hoje;
  const diasRestantes = cert.data_validade ? Math.floor((new Date(cert.data_validade) - hoje) / 86400000) : null;
  const tipoTemplate = vencido
    ? 'certificado_vencido'
    : diasRestantes !== null && diasRestantes < 60
      ? 'certificado_a_vencer'
      : 'certificado_emitido';

  const dados = {
    nomeAluno: cert.alunos?.nome || '',
    nomeCurso: cert.cursos?.nome || '',
    dataValidade: cert.data_validade ? fmtData(cert.data_validade) : null,
    diasRestantes,
    codigoVerificacao: cert.codigo_verificacao,
    nomeEscola,
    urlVerificacao,
  };

  const telefone = numero || cert.alunos?.whatsapp || cert.alunos?.telefone || '';
  abrirModalWhatsApp(tipoTemplate, dados, telefone);
}
