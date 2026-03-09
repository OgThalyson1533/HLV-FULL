# Certificados — Guia de Correções e White-label

## O que foi corrigido (v3)

### ✅ Geração de PDF — Bug crítico resolvido

**Problema:** A query original usava `.select('*, alunos(nome,cpf...), cursos(nome...)')` em um SELECT da tabela `certificados`. Essa sintaxe de *embedding* do Supabase só funciona quando há uma FK direta na tabela principal. Como `certificados` tem `aluno_id`, `curso_id`, `turma_id` mas a query usava o relacionamento inverso incorretamente, retornava `null`.

**Solução:** A nova query faz **buscas separadas e explícitas** para cada tabela relacionada:
```js
// Busca o certificado primeiro
const { data: cert } = await supabase.from('certificados').select('*').eq('matricula_id', matriculaId).single();

// Depois busca os dados relacionados em paralelo
const [alunoRes, cursoRes] = await Promise.all([
  supabase.from('alunos').select('nome, cpf, whatsapp, telefone').eq('id', cert.aluno_id).single(),
  supabase.from('cursos').select('nome, carga_horaria_horas, norma_regulamentadora').eq('id', cert.curso_id).single(),
]);
```

---

## White-label — Como configurar

Acesse **Configurações** no menu lateral.

### 1. Dados da Escola
- **Nome da Escola** → aparece no cabeçalho do certificado e na aba do browser
- **CNPJ** → exibido abaixo do nome no certificado
- **Endereço** → exibido abaixo do CNPJ no certificado
- **Logotipo** → pode ser:
  - Uma **URL pública** (ex: `https://seusite.com/logo.png`)
  - Um **arquivo local** (clique em "Enviar Arquivo" → máx. 500KB, converte para base64)

### 2. Identidade Visual (Certificado adaptativo)
- **Cor Primária** → cor principal do certificado (barra lateral, título, destaques, QR Code)
- **Cor Secundária** → gradiente da barra decorativa
- **Modo** → Claro (fundo branco) ou Escuro (fundo da cor de fundo configurada)
- **Raio de borda** → arredondamento geral da UI

### 3. Configurações do Certificado
- **Assinante** → nome que aparece na linha de assinatura
- **Cargo do Assinante** → cargo exibido abaixo do nome
- **Texto Complementar** → parágrafo extra (legislação, validade, observações)
- **URL de Verificação** → **⚠️ OBRIGATÓRIO para QR Code funcionar**

  Exemplo: `https://seusite.com/verificar`

  O QR Code gerado vai apontar para:
  `https://seusite.com/verificar?codigo=XXXX-XXXX-XXXX`

---

## QR Code de Autenticidade

O QR Code é gerado automaticamente usando [api.qrserver.com](https://api.qrserver.com) (gratuito, sem chave de API).

A URL embutida no QR Code é:
```
{url_verificacao}?codigo={codigo_verificacao}
```

Para a verificação funcionar de ponta a ponta, você precisa criar uma **página pública** na URL configurada que:
1. Leia o parâmetro `?codigo=` da URL
2. Consulte o Supabase: `SELECT * FROM certificados WHERE codigo_verificacao = $codigo`
3. Exiba os dados do certificado (ou mensagem de "não encontrado")

---

## Schema SQL necessário

Execute o arquivo `schema_melhorias.sql` **após** o `schema.sql` principal.

O bloco 9 (adicionado automaticamente) insere as chaves de tema/logo na tabela `configuracoes`:

```sql
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('logo_url',      '',          'URL ou base64 do logotipo'),
  ('cor_primaria',  '#00d4ff',   'Cor primária do tema'),
  ('cor_secundaria','#7c3aed',   'Cor secundária do tema'),
  ('modo_tema',     'dark',      'dark ou light'),
  ('raio_borda',    '8',         'Raio de borda em px')
ON CONFLICT (chave) DO NOTHING;
```

---

## Fluxo completo para emitir um certificado

1. Aluno tem status `concluido` na matrícula
2. Na tela de **Pipeline** ou **Alunos**, altere o status para `certificado_emitido`
   - Isso deve inserir um registro na tabela `certificados` (via trigger ou manualmente)
3. Acesse **Certificados** no menu
4. Clique em **PDF** na linha do aluno
5. O PDF abre em nova aba com botão de impressão/download

---

## Arquivos alterados

| Arquivo | Mudanças |
|---|---|
| `modules/certificados.js` | Reescrito — query corrigida, QR Code, white-label completo |
| `modules/configuracoes.js` | Upload de logo por arquivo adicionado |
| `schema_melhorias.sql` | Bloco 9: configs de tema/logo adicionadas |
