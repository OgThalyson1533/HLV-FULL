// ============================================================
// cep.js — Busca de CEP e preenchimento automático de endereço
// ============================================================

/**
 * Busca CEP na API ViaCEP e retorna dados do endereço.
 * @param {string} cep
 * @returns {Promise<{logradouro, bairro, cidade, estado, ibge} | null>}
 */
export async function buscarCEP(cep) {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro || '',
      bairro:     data.bairro || '',
      cidade:     data.localidade || '',
      estado:     data.uf || '',
      ibge:       data.ibge || '',
      cep:        data.cep || '',
    };
  } catch {
    return null;
  }
}

/**
 * Vincula campo de CEP ao autopreenchimento de endereço.
 *
 * Uso:
 *   vincularCEP('#campo-cep', {
 *     logradouro: '#campo-rua',
 *     cidade:     '#campo-cidade',
 *     estado:     '#campo-estado',
 *     bairro:     '#campo-bairro',     // opcional
 *   })
 *
 * @param {string|HTMLElement} campoCEP  - seletor ou elemento do input de CEP
 * @param {object} mapeamento            - mapeamento { campo: seletor }
 * @param {function} [onSucesso]         - callback chamado com os dados quando encontrado
 */
export function vincularCEP(campoCEP, mapeamento, onSucesso = null) {
  const inputCEP = typeof campoCEP === 'string' ? document.querySelector(campoCEP) : campoCEP;
  if (!inputCEP) return;

  // Máscara visual
  inputCEP.addEventListener('input', () => {
    let v = inputCEP.value.replace(/\D/g, '');
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
    inputCEP.value = v;
  });

  // Busca ao completar 8 dígitos
  inputCEP.addEventListener('blur', async () => {
    const v = inputCEP.value.replace(/\D/g, '');
    if (v.length !== 8) return;

    // Indicador de carregamento
    const spinner = document.createElement('span');
    spinner.className = 'cep-spinner material-symbols-rounded';
    spinner.textContent = 'autorenew';
    spinner.style.cssText = 'font-size:14px;color:var(--accent);animation:spin 0.8s linear infinite;position:absolute;right:8px;top:50%;transform:translateY(-50%)';
    const wrap = inputCEP.parentElement;
    if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(spinner); }

    try {
      const dados = await buscarCEP(v);
      if (dados) {
        // Preenche campos mapeados
        for (const [campo, seletor] of Object.entries(mapeamento)) {
          if (!seletor || !dados[campo]) continue;
          const el = typeof seletor === 'string' ? document.querySelector(seletor) : seletor;
          if (el && !el.value) el.value = dados[campo]; // só preenche se vazio
        }
        if (onSucesso) onSucesso(dados);

        // Feedback visual
        inputCEP.style.borderColor = 'var(--success)';
        setTimeout(() => { inputCEP.style.borderColor = ''; }, 2000);
      } else {
        inputCEP.style.borderColor = 'var(--danger)';
        setTimeout(() => { inputCEP.style.borderColor = ''; }, 2000);
      }
    } finally {
      spinner.remove();
    }
  });
}

/**
 * Formata CEP para exibição: 00000-000
 */
export function formatarCEP(cep) {
  const v = String(cep || '').replace(/\D/g, '').slice(0, 8);
  return v.length === 8 ? v.slice(0, 5) + '-' + v.slice(5) : v;
}
