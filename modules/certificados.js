// modules/certificados.js v2 — QR Code, White-label, WhatsApp
import { supabase, mostrarToast } from '../js/app.js';
import { fmtData, debounce, emptyState, renderStatCards, renderPaginacao, delegarAcoes, escapeHtml, traduzirErro } from '../js/utils.js';
import { getTema, gerarCSSCertificado } from '../js/theme.js';
import { TEMPLATES, abrirModalWhatsApp } from '../js/whatsapp.js';
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

// ── Gerar PDF com QR Code e marca adaptativa ───────────────
async function gerarPDF(matriculaId) {
  const { data: cert } = await supabase.from('certificados')
    .select('*, alunos(nome,cpf,whatsapp), cursos(nome,carga_horaria_horas,norma_regulamentadora), turmas(data_inicio,data_fim), instrutores(nome)')
    .eq('matricula_id', matriculaId).single();
  if (!cert) { mostrarToast('Certificado não encontrado', 'error'); return; }

  const [nomeEscola, assinante, cargoAssinante, textoCert, urlVerificacao, logoUrl] = await Promise.all([
    getConfig('nome_escola', 'TrainOS'),
    getConfig('assinante_cert', 'Diretor Técnico'),
    getConfig('cargo_assinante', 'Diretor Técnico'),
    getConfig('texto_cert', ''),
    getConfig('url_verificacao', ''),
    getConfig('logo_url', ''),
  ]);

  const tema = getTema();
  const cores = gerarCSSCertificado();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent((urlVerificacao || 'https://trainos.app/verificar') + '?codigo=' + cert.codigo_verificacao)}&bgcolor=${cores.corFundo.replace('#','')}&color=${tema.cor_primaria.replace('#','')}&margin=2`;

  const htmlCert = gerarHTMLCertificado(cert, { nomeEscola, assinante, cargoAssinante, textoCert, urlVerificacao, logoUrl, qrUrl, cores, tema });
  const win = window.open('', '_blank');
  if (!win) { mostrarToast('Habilite pop-ups para gerar o PDF', 'warning'); return; }
  win.document.write(htmlCert);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}

function gerarHTMLCertificado(cert, { nomeEscola, assinante, cargoAssinante, textoCert, urlVerificacao, logoUrl, qrUrl, cores, tema }) {
  const { alunos: aluno, cursos: curso, turmas: turma } = cert;
  const dataEmissao = fmtData(cert.data_emissao);
  const dataValidade = cert.data_validade ? fmtData(cert.data_validade) : 'Sem validade';
  const periodo = turma ? `${fmtData(turma.data_inicio)} a ${fmtData(turma.data_fim)}` : dataEmissao;
  const accentHex = tema.cor_primaria;
  const accentRgb = hexToRgb(accentHex);
  const isDark = tema.modo !== 'light';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Certificado — ${aluno.nome}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600&display=swap" rel="stylesheet"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#fff; }
    @media print { body { margin:0; } @page { size:A4 landscape; margin:0; } .no-print { display:none !important; } }
    .cert {
      width:297mm; height:210mm; position:relative; overflow:hidden;
      background: ${isDark
        ? `linear-gradient(135deg, ${cores.bgInicio} 0%, ${cores.bgFim} 60%, ${cores.bgInicio} 100%)`
        : `linear-gradient(135deg, #ffffff 0%, #f0f4ff 50%, #ffffff 100%)`};
      display:flex; flex-direction:column; align-items:stretch; justify-content:stretch;
    }
    /* Decoração lateral com cor da marca */
    .cert-accent-bar {
      position:absolute; left:0; top:0; bottom:0; width:12mm;
      background: linear-gradient(180deg, ${accentHex}, ${tema.cor_secundaria || accentHex});
    }
    .cert-accent-bar-r {
      position:absolute; right:0; top:0; bottom:0; width:4mm;
      background: ${accentHex}40;
    }
    /* Bordas de canto */
    .cert-corner {
      position:absolute; width:18mm; height:18mm;
      border-color:${accentHex}; border-style:solid; opacity:0.6;
    }
    .cert-corner.tl { top:10mm; left:18mm; border-width:2px 0 0 2px; }
    .cert-corner.tr { top:10mm; right:8mm;  border-width:2px 2px 0 0; }
    .cert-corner.bl { bottom:10mm; left:18mm; border-width:0 0 2px 2px; }
    .cert-corner.br { bottom:10mm; right:8mm;  border-width:0 2px 2px 0; }
    /* Fundo pontilhado sutil */
    .cert-bg-dots {
      position:absolute; inset:0;
      background-image:radial-gradient(${accentHex}18 1px, transparent 1px);
      background-size:12mm 12mm;
      pointer-events:none;
    }
    /* Conteúdo */
    .cert-body {
      position:relative; z-index:2;
      margin: 12mm 16mm 10mm 22mm;
      display:flex; flex-direction:column; height:calc(100% - 22mm);
    }
    .cert-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4mm; }
    .cert-logo-area { display:flex; align-items:center; gap:3mm; }
    .cert-logo-img { height:12mm; object-fit:contain; }
    .cert-escola { font-size:9pt; font-weight:600; color:${cores.corDestaque}; letter-spacing:1px; text-transform:uppercase; }
    .cert-escola-sub { font-size:7pt; color:${cores.corMuted}; letter-spacing:0.5px; }
    .cert-nr-badge {
      background:${accentHex}20; border:1px solid ${accentHex}40;
      padding:2mm 4mm; border-radius:2mm; font-size:8pt;
      color:${accentHex}; font-weight:600; letter-spacing:1px;
    }
    /* Centro */
    .cert-center { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
    .cert-certifica { font-size:8pt; letter-spacing:4px; text-transform:uppercase; color:${cores.corMuted}; margin-bottom:2mm; }
    .cert-title { font-family:'Playfair Display',serif; font-size:26pt; letter-spacing:4px; text-transform:uppercase; color:${accentHex}; line-height:1; margin-bottom:1mm; }
    .cert-title-sub { font-size:7pt; letter-spacing:3px; color:${cores.corMuted}; text-transform:uppercase; margin-bottom:5mm; }
    .cert-confere { font-size:9pt; color:${cores.corMuted}; margin-bottom:2mm; }
    .cert-nome { font-family:'Playfair Display',serif; font-size:22pt; font-style:italic; color:${cores.corNome}; margin-bottom:4mm; position:relative; }
    .cert-nome::after { content:''; position:absolute; bottom:-2mm; left:50%; transform:translateX(-50%); width:80mm; height:1px; background:${accentHex}50; }
    .cert-curso-intro { font-size:9pt; color:${cores.corMuted}; margin-bottom:2mm; margin-top:4mm; }
    .cert-curso { font-family:'Playfair Display',serif; font-size:14pt; color:${accentHex}; margin-bottom:2mm; }
    .cert-detalhes { font-size:8pt; color:${cores.corMuted}; letter-spacing:0.5px; }
    .cert-texto-extra { font-size:7.5pt; color:${cores.corMuted}; margin-top:3mm; font-style:italic; max-width:180mm; text-align:center; line-height:1.5; }
    /* Rodapé */
    .cert-footer { display:grid; grid-template-columns:1fr auto 1fr; align-items:end; gap:8mm; padding-top:4mm; border-top:1px solid ${accentHex}30; }
    .cert-codigo-area { font-size:7pt; color:${cores.corMuted}; }
    .cert-codigo { font-family:monospace; font-size:8pt; color:${accentHex}; font-weight:600; }
    .cert-qr { width:20mm; height:20mm; border:1px solid ${accentHex}30; border-radius:2mm; padding:1mm; background:white; }
    .cert-assinatura { text-align:center; }
    .cert-assin-linha { width:45mm; height:1px; background:${accentHex}40; margin:0 auto 2mm; }
    .cert-assin-nome { font-size:8pt; color:${cores.corTexto}; font-weight:600; }
    .cert-assin-cargo { font-size:7pt; color:${cores.corMuted}; }
    /* Botão de impressão (some ao imprimir) */
    .print-btn {
      position:fixed; bottom:20px; right:20px; z-index:999;
      padding:12px 24px; background:${accentHex}; color:#fff; border:none;
      border-radius:8px; font-size:14px; cursor:pointer; box-shadow:0 4px 20px ${accentHex}60;
    }
    .print-btn:hover { opacity:0.9; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  <div class="cert">
    <div class="cert-accent-bar"></div>
    <div class="cert-accent-bar-r"></div>
    <div class="cert-bg-dots"></div>
    <div class="cert-corner tl"></div>
    <div class="cert-corner tr"></div>
    <div class="cert-corner bl"></div>
    <div class="cert-corner br"></div>
    <div class="cert-body">
      <!-- Cabeçalho -->
      <div class="cert-top">
        <div class="cert-logo-area">
          ${logoUrl ? `<img src="${logoUrl}" class="cert-logo-img" alt="${nomeEscola}" onerror="this.style.display='none'"/>` : ''}
          <div>
            <div class="cert-escola">${nomeEscola}</div>
            <div class="cert-escola-sub">Escola de Treinamentos Profissionais</div>
          </div>
        </div>
        ${curso.norma_regulamentadora ? `<div class="cert-nr-badge">${curso.norma_regulamentadora}</div>` : ''}
      </div>
      <!-- Centro -->
      <div class="cert-center">
        <div class="cert-certifica">CERTIFICA QUE</div>
        <div class="cert-title">Certificado</div>
        <div class="cert-title-sub">de Conclusão de Curso</div>
        <div class="cert-confere">O(A) profissional</div>
        <div class="cert-nome">${aluno.nome}</div>
        <div class="cert-curso-intro">concluiu com aproveitamento o curso de</div>
        <div class="cert-curso">${curso.nome}</div>
        <div class="cert-detalhes">Carga Horária: ${curso.carga_horaria_horas}h &nbsp;·&nbsp; Período: ${periodo}</div>
        ${textoCert ? `<div class="cert-texto-extra">${textoCert}</div>` : ''}
      </div>
      <!-- Rodapé -->
      <div class="cert-footer">
        <!-- Esquerda: dados -->
        <div class="cert-codigo-area">
          <div>Código de Verificação:</div>
          <div class="cert-codigo">${cert.codigo_verificacao}</div>
          <div style="margin-top:1mm">Emissão: ${dataEmissao}</div>
          ${cert.data_validade ? `<div>Válido até: <strong>${dataValidade}</strong></div>` : ''}
          ${aluno.cpf ? `<div>CPF: ${aluno.cpf}</div>` : ''}
        </div>
        <!-- Centro: QR Code -->
        <div style="text-align:center">
          <img src="${qrUrl}" class="cert-qr" alt="QR Code" />
          <div style="font-size:6pt;color:${cores.corMuted};margin-top:1mm">Verificar autenticidade</div>
        </div>
        <!-- Direita: assinatura -->
        <div class="cert-assinatura">
          <div class="cert-assin-linha"></div>
          <div class="cert-assin-nome">${assinante}</div>
          <div class="cert-assin-cargo">${cargoAssinante}</div>
          <div class="cert-assin-cargo" style="margin-top:1mm">${nomeEscola}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Enviar WhatsApp sobre certificado ─────────────────────
async function enviarWhatsAppCert(matriculaId, numero) {
  const { data: cert } = await supabase.from('certificados')
    .select('*, alunos(nome,whatsapp,telefone), cursos(nome)')
    .eq('matricula_id', matriculaId).single();
  if (!cert) return;

  const [nomeEscola, urlVerificacao] = await Promise.all([
    getConfig('nome_escola', 'TrainOS'),
    getConfig('url_verificacao', ''),
  ]);

  const hoje = new Date();
  const vencido = cert.data_validade && new Date(cert.data_validade) < hoje;
  const diasRestantes = cert.data_validade ? Math.floor((new Date(cert.data_validade) - hoje) / 86400000) : null;
  const tipoTemplate = vencido ? 'certificado_vencido' : diasRestantes !== null && diasRestantes < 60 ? 'certificado_a_vencer' : 'certificado_emitido';

  const dados = {
    nomeAluno: cert.alunos.nome,
    nomeCurso: cert.cursos.nome,
    dataValidade: cert.data_validade ? fmtData(cert.data_validade) : null,
    diasRestantes,
    codigoVerificacao: cert.codigo_verificacao,
    nomeEscola,
    urlVerificacao,
  };

  const telefone = numero || cert.alunos?.whatsapp || cert.alunos?.telefone || '';
  abrirModalWhatsApp(tipoTemplate, dados, telefone);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
