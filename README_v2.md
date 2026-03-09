# TrainOS v2.0 — Sistema de Gestão de Escola de Treinamentos

## O que há de novo na v2

### Correções Críticas de Segurança
- ✅ Funções `window.*` removidas — substituídas por event delegation
- ✅ `escapeHtml()` aplicado em todos os dados do banco renderizados no DOM
- ✅ Auto-promoção de admin via RPC apenas (sem UPDATE direto pelo cliente)
- ✅ Bug do filtro de curso em Renovações corrigido (ID em vez de nome)

### Novos Utilitários (js/utils.js)
- `fmtData`, `fmtMoeda`, `debounce` centralizados (sem duplicação)
- `escapeHtml` — sanitização de dados antes de render
- `traduzirErro` — mensagens de erro amigáveis por código Postgres
- `criarModal`, `confirmar` — componentes reutilizáveis
- `renderStatCards`, `renderPaginacao` — helpers DRY
- `skeletonTabela` — loading state visual
- `delegarAcoes` — event delegation centralizado

### Funcionalidades Novas
- 🆕 **Ficha completa do aluno** — abas: Dados, Histórico, Financeiro, Certificados + KPIs
- 🆕 **Lista de alunos por turma** — lançamento de notas e frequências em lote, exportação CSV
- 🆕 **Módulo de Configurações** — nome da escola, dados do certificado, gestão de usuários
- 🆕 **Campo link online nas turmas** — suporte a EAD/híbrido

### Melhorias no Schema SQL
Execute `schema_melhorias.sql` após o `schema.sql` original:
- Tabela `configuracoes` — personalização do sistema
- Tabela `lista_espera_turmas` — fila para turmas lotadas
- Tabela `notificacoes_enviadas` — log de comunicações
- Campos adicionais: `bio` em instrutores, `link_online` em turmas, `categoria/modalidade` em cursos
- Views novas: `vw_cursos_populares`, `vw_fluxo_caixa`, `vw_inadimplencia`, `vw_ocupacao_turmas`

## Instalação

### Opção A — Servidor local simples
```bash
npx serve .
# ou
python3 -m http.server 8080
```

### Opção B — Vite (recomendado para produção)
```bash
npm create vite@latest trainos -- --template vanilla
# Copiar os arquivos e ajustar o import do supabase para import.meta.env
```

## Configuração do Supabase

1. Execute `schema.sql` no SQL Editor do Supabase
2. Execute `schema_melhorias.sql` em seguida
3. Execute `rls_policies.sql`
4. Acesse o sistema e configure a URL e chave anon na tela de setup

## Próximos Passos Recomendados

1. **Notificações automáticas**: criar Supabase Edge Function com Resend
2. **Verificação pública de certificado**: página `/verificar?codigo=XXX`
3. **Drag-and-drop no Pipeline**: integrar SortableJS
4. **Gráficos interativos**: integrar Chart.js no Dashboard e Relatórios
5. **PWA**: adicionar service worker para cache offline
