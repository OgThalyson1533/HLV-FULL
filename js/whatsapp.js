// ============================================================
// whatsapp.js — Templates e envio de mensagens via WhatsApp
// ============================================================

/**
 * Gera URL do WhatsApp Web com mensagem pré-preenchida
 * @param {string} numero - Telefone com DDD, sem formatação
 * @param {string} mensagem - Texto da mensagem
 */
export function urlWhatsApp(numero, mensagem) {
  const num = '55' + numero.replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`;
}

/** Abre WhatsApp em nova aba */
export function enviarWhatsApp(numero, mensagem) {
  window.open(urlWhatsApp(numero, mensagem), '_blank');
}

// ── TEMPLATES ──────────────────────────────────────────────

export const TEMPLATES = {

  // 📜 Certificado emitido
  certificado_emitido: ({ nomeAluno, nomeCurso, dataValidade, codigoVerificacao, nomeEscola, urlVerificacao }) =>
`Olá, *${nomeAluno}*! 🎓

Parabéns! Seu certificado do curso *${nomeCurso}* foi emitido com sucesso!

📋 *Código:* ${codigoVerificacao}
${dataValidade ? `📅 *Válido até:* ${dataValidade}` : '✅ *Sem data de validade*'}

Você pode verificar a autenticidade em:
${urlVerificacao || 'Solicite ao responsável o link de verificação'}

Atenciosamente,
*${nomeEscola}* 🏆`,

  // ⏰ Certificado a vencer (60 dias)
  certificado_a_vencer: ({ nomeAluno, nomeCurso, dataValidade, diasRestantes, nomeEscola }) =>
`Olá, *${nomeAluno}*! ⏰

Atenção: seu certificado de *${nomeCurso}* vence em *${diasRestantes} dias* (${dataValidade}).

Para manter sua qualificação em dia, entre em contato conosco para agendar a renovação.

📞 Aguardamos seu contato!

*${nomeEscola}*`,

  // ❌ Certificado vencido
  certificado_vencido: ({ nomeAluno, nomeCurso, dataValidade, nomeEscola }) =>
`Olá, *${nomeAluno}*! 🔴

Seu certificado de *${nomeCurso}* venceu em ${dataValidade}.

Manter suas certificações atualizadas é *obrigação legal* para trabalho seguro. 

👉 Entre em contato para renovar com prioridade!

*${nomeEscola}*`,

  // 📅 Próxima aula (aviso)
  proxima_aula: ({ nomeAluno, nomeCurso, dataInicio, horario, local, linkOnline, instrutor, nomeEscola }) =>
`Olá, *${nomeAluno}*! 📚

Lembrete da sua próxima aula:

📌 *Curso:* ${nomeCurso}
📅 *Data:* ${dataInicio}
⏰ *Horário:* ${horario || 'Confirmar com instrutor'}
📍 *Local:* ${linkOnline ? `Online — ${linkOnline}` : (local || 'A confirmar')}
👤 *Instrutor:* ${instrutor || 'A definir'}

Em caso de dúvidas, fale conosco!

*${nomeEscola}* 🎓`,

  // ✅ Aprovado no curso
  aluno_aprovado: ({ nomeAluno, nomeCurso, nota, frequencia, nomeEscola }) =>
`Olá, *${nomeAluno}*! 🎉

Temos ótimas notícias: você foi *APROVADO* no curso de *${nomeCurso}*!

${nota != null ? `📊 *Nota:* ${nota}\n` : ''}${frequencia != null ? `📋 *Frequência:* ${frequencia}%\n` : ''}
Seu certificado será emitido em breve. Aguarde!

*${nomeEscola}* 🏆`,

  // ❌ Reprovado no curso
  aluno_reprovado: ({ nomeAluno, nomeCurso, nota, frequencia, nomeEscola }) =>
`Olá, *${nomeAluno}*.

Após avaliação do curso *${nomeCurso}*, infelizmente você não atingiu os critérios mínimos de aprovação.

${nota != null ? `📊 *Nota:* ${nota}\n` : ''}${frequencia != null ? `📋 *Frequência:* ${frequencia}%\n` : ''}
Entre em contato para verificar possibilidades de recuperação ou nova turma.

*${nomeEscola}*`,

  // 💰 Cobrança — aluno (pessoa física)
  cobranca_aluno: ({ nomeAluno, nomeCurso, valor, dataVencimento, numeroRecibo, nomeEscola }) =>
`Olá, *${nomeAluno}*! 💰

Lembrete de pagamento:

📄 *Recibo:* ${numeroRecibo}
📚 *Curso:* ${nomeCurso}
💲 *Valor:* R$ ${valor}
📅 *Vencimento:* ${dataVencimento}

Regularize para garantir sua matrícula e certificado.

Para pagamento ou dúvidas, entre em contato.

*${nomeEscola}*`,

  // 🏢 Cobrança — empresa
  cobranca_empresa: ({ nomeResponsavel, nomeEmpresa, qtdAlunos, valor, dataVencimento, numeroRecibo, nomeEscola }) =>
`Olá, *${nomeResponsavel}*! 🏢

Prezado(a) responsável pela *${nomeEmpresa}*:

📄 *Ref.:* ${numeroRecibo}
👥 *Alunos:* ${qtdAlunos}
💲 *Valor total:* R$ ${valor}
📅 *Vencimento:* ${dataVencimento}

Prezamos pela parceria e aguardamos a regularização para emissão dos certificados.

*${nomeEscola}*`,

  // 📢 Informação geral
  informativo: ({ nomeAluno, mensagem, nomeEscola }) =>
`Olá, *${nomeAluno}*! 👋

${mensagem}

*${nomeEscola}*`,
};

// ── MODAL DE ENVIO DE WHATSAPP ────────────────────────────
import { escapeHtml } from './utils.js';

/**
 * Abre modal para compor e enviar mensagem WhatsApp
 * @param {string} tipo - chave em TEMPLATES
 * @param {object} dados - dados para preencher o template
 * @param {string} numero - telefone do destinatário
 */
export function abrirModalWhatsApp(tipo, dados, numero) {
  const template = TEMPLATES[tipo];
  if (!template) return;

  const mensagemPadrao = template(dados);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h2 style="display:flex;align-items:center;gap:8px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Enviar via WhatsApp
      </h2>
      <button class="btn-icon" id="fc-wpp"><span class="material-symbols-rounded">close</span></button>
    </div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:11px">Número (com DDD)</label>
        <input id="wpp-numero" value="${escapeHtml(numero||'')}" placeholder="11999999999" style="font-family:var(--font-mono)"/>
      </div>
      <div class="form-group">
        <label style="font-size:11px">Mensagem (editável)</label>
        <textarea id="wpp-msg" rows="10" style="font-size:12px;line-height:1.6;resize:vertical">${escapeHtml(mensagemPadrao)}</textarea>
      </div>
      <div style="font-size:11px;color:var(--text-tertiary)">
        💡 A mensagem será aberta no WhatsApp Web — você confirma o envio lá.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="fc-wpp2">Cancelar</button>
      <button class="btn btn-primary" id="btn-abrir-wpp" style="background:#25d366;border-color:#25d366">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="vertical-align:middle;margin-right:4px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Abrir no WhatsApp
      </button>
    </div>
  </div>`;

  document.body.appendChild(backdrop);
  const fechar = () => backdrop.remove();
  backdrop.querySelector('#fc-wpp').addEventListener('click', fechar);
  backdrop.querySelector('#fc-wpp2').addEventListener('click', fechar);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) fechar(); });

  backdrop.querySelector('#btn-abrir-wpp').addEventListener('click', () => {
    const num = backdrop.querySelector('#wpp-numero').value.replace(/\D/g,'');
    const msg = backdrop.querySelector('#wpp-msg').value;
    if (!num || num.length < 10) { alert('Informe um número válido com DDD'); return; }
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
    fechar();
  });
}
