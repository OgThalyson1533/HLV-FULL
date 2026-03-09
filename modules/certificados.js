// modules/certificados.js — Gestão de Certificados
import { supabase, mostrarToast } from '../js/app.js';

let state = { pagina: 1, busca: '', filtroStatus: '' };
const PAGE_SIZE = 25;

export async function renderCertificados() {
  document.getElementById('topbar-title').textContent = 'Certificados';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>CERTIFICADOS</h1><p>Emissão e histórico documental</p></div>
    </div>
    <div class="stats-grid" id="stats-cert"></div>
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-search"><input type="text" id="busca-cert" placeholder="Buscar por aluno, curso ou código..." /></div>
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

  document.getElementById('busca-cert').oninput = debounce(e => { state.busca = e.target.value; state.pagina = 1; carregar(); }, 300);
  document.getElementById('filtro-cert-status').onchange = e => { state.filtroStatus = e.target.value; state.pagina = 1; carregar(); };
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
  document.getElementById('stats-cert').innerHTML = [
    { icon: 'workspace_premium', label: 'Total Emitidos', value: total.count ?? 0, cor: 'var(--accent)' },
    { icon: 'verified', label: 'Válidos', value: validos.count ?? 0, cor: 'var(--success)' },
    { icon: 'schedule', label: 'A Vencer (60d)', value: aVencer.count ?? 0, cor: 'var(--warning)' },
    { icon: 'running_with_errors', label: 'Vencidos', value: vencidos.count ?? 0, cor: 'var(--danger)' },
  ].map(s => `<div class="stat-card"><div class="stat-icon" style="color:${s.cor}"><span class="material-symbols-rounded">${s.icon}</span></div>
    <div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');
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
  if (error) { mostrarToast('Erro ao carregar certificados', 'error'); return; }
  renderTabela(data);
  document.getElementById('info-cert').textContent = `${count} certificados`;
  const pages = Math.ceil(count / PAGE_SIZE);
  document.getElementById('pag-cert').innerHTML = `
    <button class="btn btn-sm btn-secondary" ${state.pagina <= 1 ? 'disabled' : ''} onclick="window._pgCert(${state.pagina - 1})">‹</button>
    <span class="page-info">${state.pagina} / ${pages || 1}</span>
    <button class="btn btn-sm btn-secondary" ${state.pagina >= pages ? 'disabled' : ''} onclick="window._pgCert(${state.pagina + 1})">›</button>`;
  window._pgCert = p => { state.pagina = p; carregar(); };
}

const certStatusConfig = {
  valido:        { badge: 'badge-success', label: 'Válido' },
  a_vencer_60d:  { badge: 'badge-warning', label: 'A Vencer' },
  a_vencer_90d:  { badge: 'badge-warning', label: 'A Vencer' },
  critico_30d:   { badge: 'badge-danger',  label: 'Crítico' },
  vencido:       { badge: 'badge-danger',  label: 'Vencido' },
  sem_validade:  { badge: 'badge-neutral', label: 'Sem Validade' },
};

function renderTabela(rows) {
  const wrap = document.getElementById('tabela-cert-wrap');
  if (!rows?.length) { wrap.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">workspace_premium</span><p>Nenhum certificado encontrado</p></div>`; return; }
  wrap.innerHTML = `<table><thead><tr><th>Código</th><th>Aluno</th><th>Curso</th><th>Emissão</th><th>Validade</th><th>Situação</th><th>Ações</th></tr></thead>
    <tbody>${rows.map(c => {
      const sc = certStatusConfig[c.status_certificado] || { badge: 'badge-neutral', label: c.status_certificado };
      const diasRestantes = c.cert_validade ? Math.ceil((new Date(c.cert_validade) - new Date()) / 86400000) : null;
      return `<tr>
        <td class="mono text-sm" style="color:var(--accent)">${c.certificado_codigo}</td>
        <td><strong>${c.aluno_nome}</strong><br><span class="text-muted text-xs">${c.empresa_nome || 'PF'}</span></td>
        <td class="text-sm">${c.curso_nome}<br><span class="text-muted text-xs">${c.carga_horaria_horas}h</span></td>
        <td class="text-sm">${fmtData(c.cert_emissao)}</td>
        <td class="text-sm">
          ${c.cert_validade ? fmtData(c.cert_validade) : '<span class="text-muted">—</span>'}
          ${diasRestantes !== null ? `<br><span class="text-xs ${diasRestantes < 0 ? 'text-danger' : diasRestantes < 60 ? 'text-warning' : 'text-muted'}">${diasRestantes < 0 ? Math.abs(diasRestantes) + 'd vencido' : diasRestantes + 'd restantes'}</span>` : ''}
        </td>
        <td><span class="badge ${sc.badge}">${sc.label}</span></td>
        <td><div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" onclick="window._gerarPDF('${c.matricula_id}')"><span class="material-symbols-rounded" style="font-size:14px">picture_as_pdf</span> PDF</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// ── Geração de PDF do Certificado ─────────────────────────
window._gerarPDF = async matriculaId => {
  const { data: cert } = await supabase.from('certificados')
    .select('*, alunos(nome,cpf), cursos(nome,carga_horaria_horas,norma_regulamentadora), turmas(data_inicio,data_fim)')
    .eq('matricula_id', matriculaId).single();

  if (!cert) { mostrarToast('Certificado não encontrado', 'error'); return; }

  const htmlCert = gerarHTMLCertificado(cert);
  const win = window.open('', '_blank');
  win.document.write(htmlCert);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
};

function gerarHTMLCertificado(cert) {
  const aluno = cert.alunos;
  const curso = cert.cursos;
  const turma = cert.turmas;
  const dataEmissao = fmtData(cert.data_emissao);
  const dataValidade = cert.data_validade ? fmtData(cert.data_validade) : 'Sem validade';
  const periodo = turma ? `${fmtData(turma.data_inicio)} a ${fmtData(turma.data_fim)}` : dataEmissao;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Certificado — ${aluno.nome}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;600&display=swap" rel="stylesheet"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Source Sans 3', sans-serif; background:#fff; }
    @media print { body { margin:0; } @page { size:A4 landscape; margin:0; } }
    .cert {
      width:297mm; height:210mm; position:relative; overflow:hidden;
      background: linear-gradient(135deg, #0a0f1a 0%, #0d1b2a 50%, #0a0f1a 100%);
      display:flex; align-items:center; justify-content:center;
    }
    .cert-border {
      position:absolute; inset:12mm;
      border:2px solid rgba(0,212,255,0.3);
      border-radius:4mm;
    }
    .cert-border::after {
      content:''; position:absolute; inset:4px;
      border:1px solid rgba(0,212,255,0.15);
      border-radius:3mm;
    }
    .cert-corner {
      position:absolute; width:20mm; height:20mm;
      border-color: #00d4ff; border-style:solid;
    }
    .cert-corner.tl { top:14mm; left:14mm; border-width:2px 0 0 2px; }
    .cert-corner.tr { top:14mm; right:14mm; border-width:2px 2px 0 0; }
    .cert-corner.bl { bottom:14mm; left:14mm; border-width:0 0 2px 2px; }
    .cert-corner.br { bottom:14mm; right:14mm; border-width:0 2px 2px 0; }
    .cert-content { text-align:center; color:#e6edf3; padding:20mm; position:relative; z-index:2; }
    .cert-logo { font-size:11pt; color:rgba(0,212,255,0.7); letter-spacing:4px; text-transform:uppercase; margin-bottom:5mm; }
    .cert-title { font-family:'Playfair Display',serif; font-size:28pt; color:#00d4ff; letter-spacing:3px; text-transform:uppercase; margin-bottom:3mm; }
    .cert-subtitle { font-size:10pt; color:rgba(230,237,243,0.5); letter-spacing:2px; margin-bottom:8mm; }
    .cert-confere { font-size:10pt; color:rgba(230,237,243,0.6); margin-bottom:4mm; }
    .cert-nome { font-family:'Playfair Display',serif; font-size:24pt; font-style:italic; color:#ffffff; border-bottom:1px solid rgba(0,212,255,0.4); display:inline-block; padding-bottom:2mm; margin-bottom:6mm; min-width:120mm; }
    .cert-texto { font-size:10pt; color:rgba(230,237,243,0.7); line-height:1.6; margin-bottom:6mm; max-width:180mm; }
    .cert-curso { font-family:'Playfair Display',serif; font-size:16pt; color:#00d4ff; margin:2mm 0; }
    .cert-detalhe { font-size:9pt; color:rgba(0,212,255,0.6); letter-spacing:1px; }
    .cert-footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top:10mm; padding-top:5mm; border-top:1px solid rgba(0,212,255,0.2); font-size:8pt; color:rgba(230,237,243,0.4); }
    .cert-assinatura { text-align:center; }
    .cert-assinatura-linha { width:50mm; border-top:1px solid rgba(230,237,243,0.3); margin:0 auto 2mm; }
    .cert-nr { background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.3); padding:1mm 4mm; border-radius:2mm; font-size:8pt; color:rgba(0,212,255,0.8); display:inline-block; margin-top:2mm; }
    .cert-bg-lines { position:absolute; inset:0; background:repeating-linear-gradient(0deg, transparent, transparent 8mm, rgba(0,212,255,0.02) 8mm, rgba(0,212,255,0.02) 8.5mm); pointer-events:none; }
  </style>
</head>
<body>
  <div class="cert">
    <div class="cert-bg-lines"></div>
    <div class="cert-border"></div>
    <div class="cert-corner tl"></div>
    <div class="cert-corner tr"></div>
    <div class="cert-corner bl"></div>
    <div class="cert-corner br"></div>
    <div class="cert-content">
      <div class="cert-logo">TrainOS · Escola de Treinamentos</div>
      <div class="cert-title">Certificado</div>
      <div class="cert-subtitle">de Conclusão de Curso</div>
      <div class="cert-confere">Certificamos que</div>
      <div class="cert-nome">${aluno.nome}</div>
      <div class="cert-texto">
        concluiu com aproveitamento o curso de
      </div>
      <div class="cert-curso">${curso.nome}</div>
      <div class="cert-detalhe">Carga Horária: ${curso.carga_horaria_horas}h · Período: ${periodo}</div>
      ${curso.norma_regulamentadora ? `<div class="cert-nr">${curso.norma_regulamentadora}</div>` : ''}
      <div class="cert-footer">
        <div>
          <div>Código: <strong style="color:rgba(0,212,255,0.8)">${cert.codigo_verificacao}</strong></div>
          <div>Emissão: ${dataEmissao}</div>
          ${cert.data_validade ? `<div>Válido até: <strong>${dataValidade}</strong></div>` : ''}
        </div>
        <div class="cert-assinatura">
          <div class="cert-assinatura-linha"></div>
          <div>${cert.instrutor_nome || 'Diretor Técnico'}</div>
          <div style="color:rgba(230,237,243,0.3)">Instrutor Responsável</div>
        </div>
        <div style="text-align:right">
          <div>CPF: ${aluno.cpf || '—'}</div>
          <div style="color:rgba(230,237,243,0.3);font-size:7pt">Verifique em trainos.app/verificar</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const fmtData = d => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
