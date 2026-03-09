// modules/relatorios.js — Relatórios e BI
import { supabase } from '../js/supabase.js';
import { mostrarToast } from '../js/app.js';

export async function renderRelatorios() {
  document.getElementById('topbar-title').textContent = 'Relatórios';
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h1>RELATÓRIOS</h1><p>Business Intelligence e exportações</p></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px">
      ${[
        { id: 'rel-pipeline', icon: 'account_tree',  label: 'Pipeline Completo',     sub: 'Jornada de todos os alunos' },
        { id: 'rel-fin',      icon: 'payments',       label: 'Financeiro Detalhado',  sub: 'Recebimentos e pendências' },
        { id: 'rel-cert',     icon: 'workspace_premium', label: 'Certificados',       sub: 'Emissões e validades' },
        { id: 'rel-ven',      icon: 'autorenew',      label: 'Renovações',            sub: 'Alertas e conversões' },
        { id: 'rel-turmas',   icon: 'calendar_month', label: 'Turmas',                sub: 'Ocupação e desempenho' },
        { id: 'rel-empresas', icon: 'business',       label: 'Empresas B2B',          sub: 'Clientes corporativos' },
      ].map(r => `
        <div class="stat-card rel-btn" data-rel="${r.id}" style="cursor:pointer;text-align:center;padding:20px">
          <span class="material-symbols-rounded" style="font-size:32px;color:var(--accent);display:block;margin-bottom:8px">${r.icon}</span>
          <div style="font-weight:600;font-size:14px">${r.label}</div>
          <div class="text-xs text-muted" style="margin-top:4px">${r.sub}</div>
        </div>`).join('')}
    </div>

    <div class="card" id="relatorio-content">
      <div class="empty-state">
        <span class="material-symbols-rounded">bar_chart</span>
        <p>Selecione um relatório acima</p>
      </div>
    </div>`;

  document.querySelectorAll('.rel-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.rel-btn').forEach(b => b.style.borderColor = '');
      btn.style.borderColor = 'var(--accent)';
      carregarRelatorio(btn.dataset.rel);
    };
  });
}

async function carregarRelatorio(id) {
  const el = document.getElementById('relatorio-content');
  el.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Carregando...</p></div>`;
  const fns = { 'rel-pipeline': relPipeline, 'rel-fin': relFinanceiro, 'rel-cert': relCertificados, 'rel-ven': relRenovacoes, 'rel-turmas': relTurmas, 'rel-empresas': relEmpresas };
  if (fns[id]) await fns[id](el);
}

async function relPipeline(el) {
  const { data } = await supabase.from('vw_pipeline_operacional').select('*').order('data_matricula', { ascending: false }).limit(500);
  el.innerHTML = criarHeaderRelatorio('Pipeline Operacional', data, [
    'aluno_nome','aluno_cpf','empresa_nome','curso_nome','turma_codigo','status',
    'data_matricula','data_conclusao','nota_final','frequencia_percent',
    'certificado_codigo','cert_emissao','cert_validade','status_certificado'
  ], ['Aluno','CPF','Empresa','Curso','Turma','Status','Matrícula','Conclusão','Nota','Freq.%','Cert. Código','Cert. Emissão','Cert. Validade','Status Cert.']);
}

async function relFinanceiro(el) {
  const { data } = await supabase.from('pagamentos').select('*, alunos(nome,cpf), empresas(nome_fantasia), matriculas(cursos(nome))').order('criado_em', { ascending: false }).limit(500);
  const rows = (data || []).map(p => ({
    aluno: p.alunos?.nome, cpf: p.alunos?.cpf, empresa: p.empresas?.nome_fantasia,
    curso: p.matriculas?.cursos?.nome, recibo: p.numero_recibo,
    cobrado: p.valor_cobrado, recebido: p.valor_recebido,
    status: p.status, tipo: p.tipo_pagamento, vencimento: p.data_vencimento,
    recebimento: p.data_recebimento,
  }));
  el.innerHTML = criarHeaderRelatorio('Relatório Financeiro', rows, Object.keys(rows[0] || {}), ['Aluno','CPF','Empresa','Curso','Recibo','Cobrado','Recebido','Status','Tipo','Vencimento','Recebimento']);
}

async function relCertificados(el) {
  const { data } = await supabase.from('vw_pipeline_operacional').select('*').not('certificado_codigo', 'is', null).order('cert_emissao', { ascending: false }).limit(500);
  el.innerHTML = criarHeaderRelatorio('Certificados Emitidos', data, [
    'aluno_nome','aluno_cpf','empresa_nome','curso_nome','certificado_codigo',
    'cert_emissao','cert_validade','status_certificado','instrutor_nome'
  ], ['Aluno','CPF','Empresa','Curso','Código','Emissão','Validade','Situação','Instrutor']);
}

async function relRenovacoes(el) {
  const { data } = await supabase.from('vw_alertas_renovacao').select('*').order('data_validade');
  el.innerHTML = criarHeaderRelatorio('Alertas de Renovação', data, [
    'aluno_nome','responsavel_nome','telefone','whatsapp','email',
    'empresa_nome','curso_nome','data_emissao','data_validade','dias_vencido','nivel_alerta','ultimo_contato'
  ], ['Aluno','Responsável','Telefone','WhatsApp','E-mail','Empresa','Curso','Emissão','Validade','Dias','Nível','Último Contato']);
}

async function relTurmas(el) {
  const { data } = await supabase.from('turmas').select('*, cursos(nome), instrutores(nome)').order('data_inicio', { ascending: false }).limit(500);
  const rows = (data || []).map(t => ({
    codigo: t.codigo, curso: t.cursos?.nome, instrutor: t.instrutores?.nome,
    inicio: t.data_inicio, fim: t.data_fim, status: t.status,
    vagas_total: t.vagas_total, vagas_disp: t.vagas_disponiveis,
    ocupacao: t.vagas_total > 0 ? Math.round((t.vagas_total - t.vagas_disponiveis) / t.vagas_total * 100) + '%' : '—',
    local: t.local,
  }));
  el.innerHTML = criarHeaderRelatorio('Turmas', rows, Object.keys(rows[0] || {}), ['Código','Curso','Instrutor','Início','Fim','Status','Total Vagas','Vagas Disp.','Ocupação','Local']);
}

async function relEmpresas(el) {
  const { data: emp } = await supabase.from('empresas').select('*, alunos(count)').eq('ativo', true).order('razao_social');
  el.innerHTML = criarHeaderRelatorio('Empresas B2B', emp || [], [
    'razao_social','nome_fantasia','cnpj','responsavel_nome','responsavel_telefone','responsavel_email','cidade','estado'
  ], ['Razão Social','Nome Fantasia','CNPJ','Responsável','Telefone','E-mail','Cidade','UF']);
}

// ── Helpers ───────────────────────────────────────────────
function criarHeaderRelatorio(titulo, data, campos, cabecalhos) {
  const total = (data || []).length;
  return `
    <div class="card-header" style="margin-bottom:16px">
      <span class="card-title">${titulo.toUpperCase()} — ${total} registros</span>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="window._exportCSV()"><span class="material-symbols-rounded" style="font-size:14px">download</span> CSV</button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table id="rel-tabela"><thead><tr>${cabecalhos.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${(data || []).slice(0, 100).map(row =>
          `<tr>${campos.map(c => `<td class="text-sm">${formatCell(row[c])}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table>
    </div>
    ${total > 100 ? `<div class="text-muted text-sm" style="padding:12px">Mostrando 100 de ${total}. Exporte o CSV para ver todos.</div>` : ''}`;

  // Armazenar para export
  window.__relData = { data, campos, cabecalhos, titulo };
}

function formatCell(val) {
  if (val === null || val === undefined) return '<span class="text-muted">—</span>';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'number') return val.toLocaleString('pt-BR');
  const s = String(val);
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(s).toLocaleDateString('pt-BR');
  return s;
}

window._exportCSV = () => {
  const { data, campos, cabecalhos, titulo } = window.__relData || {};
  if (!data) return;
  const rows = [cabecalhos.join(';')];
  data.forEach(row => rows.push(campos.map(c => {
    const v = row[c]; if (v === null || v === undefined) return '';
    return String(v).replace(/;/g, ',');
  }).join(';')));
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `trainos_${titulo.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  mostrarToast('CSV exportado!', 'success');
};
