# TrainOS — Sistema de Gestão de Escola de Treinamentos

Sistema completo para gestão operacional, comercial, financeira e documental de escolas de treinamentos (Empilhadeira, Munck, NR35, etc.).

---

## Stack Tecnológica

| Camada       | Tecnologia                              |
|--------------|-----------------------------------------|
| Banco/Auth   | Supabase (PostgreSQL + Auth + Realtime) |
| Frontend     | HTML5 · CSS3 · Vanilla JS (ES Modules) |
| Módulos JS   | import/export nativos via ES Modules    |
| Ícones       | Material Symbols Rounded                |
| Fontes       | DM Sans + Space Mono                    |
| Tema         | Dark Mode nativo                        |

---

## Estrutura de Arquivos

```
treinamentos-system/
│
├── index.html                  # Entry point da SPA
│
├── css/
│   └── style.css               # Design system completo (tokens, componentes)
│
├── js/
│   ├── supabase.js             # Cliente Supabase + helpers genéricos
│   └── app.js                  # Bootstrap, roteador hash-based, shell da UI
│
├── modules/                    # Módulos de cada tela (lazy-loaded)
│   ├── dashboard.js            # (Etapa futura)
│   ├── alunos.js               # (Etapa 2)
│   ├── instrutores.js          # (Etapa 2)
│   ├── empresas.js             # (Etapa 2)
│   ├── cursos.js               # (Etapa 2)
│   ├── turmas.js               # (Etapa 2)
│   ├── pipeline.js             # (Etapa 3)
│   ├── financeiro.js           # (Etapa 4)
│   ├── certificados.js         # (Etapa 5)
│   ├── renovacoes.js           # (Etapa 6)
│   └── relatorios.js           # (Etapa 7)
│
├── schema.sql                  # Schema completo do banco de dados
├── rls_policies.sql            # Políticas RLS do Supabase
└── README.md                   # Este arquivo
```

---

## Setup — Passo a Passo

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Aguarde a inicialização do banco (≈2 min)

### 2. Executar o Schema SQL

No Supabase Dashboard → **SQL Editor**:

1. Cole e execute o conteúdo de `schema.sql`
2. Cole e execute o conteúdo de `rls_policies.sql`

> **Atenção:** Execute `schema.sql` primeiro, depois `rls_policies.sql`.

### 3. Configurar credenciais

Abra `js/supabase.js` e substitua:

```js
const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_PUBLIC_KEY';
```

Encontre esses valores em: **Project Settings → API → Project URL / anon public key**

### 4. Criar primeiro usuário Admin

No Supabase Dashboard → **Authentication → Users → Invite User**

Após criar, execute no SQL Editor para definir como admin:

```sql
UPDATE perfis
SET perfil = 'admin'
WHERE email = 'seu@email.com';
```

### 5. Servir o frontend

Qualquer servidor HTTP estático funciona. Exemplos:

```bash
# Python
python3 -m http.server 3000

# Node.js (npx)
npx serve .

# VS Code Live Server
# Instale a extensão Live Server e clique em "Go Live"
```

Acesse: `http://localhost:3000`

---

## Modelagem do Banco — Visão Geral

### Tabelas Principais

| Tabela                         | Descrição                                    |
|-------------------------------|----------------------------------------------|
| `perfis`                      | Usuários do sistema (espelha auth.users)     |
| `alunos`                      | Cadastro de alunos (PF e vinculados a empresa)|
| `empresas`                    | Clientes B2B                                 |
| `instrutores`                 | Instrutores dos cursos                       |
| `cursos`                      | Catálogo de cursos com validade/NR           |
| `turmas`                      | Turmas abertas por curso + instrutor         |
| `matriculas`                  | Core da jornada do aluno (pipeline)          |
| `matriculas_historico_status` | Auditoria de cada mudança de status          |
| `pagamentos`                  | Controle financeiro por matrícula            |
| `certificados`                | Emissão com validade calculada automaticamente|
| `contatos_renovacao`          | CRM de renovações com tracking de conversão  |

### Views para BI

| View                     | Finalidade                                       |
|--------------------------|--------------------------------------------------|
| `vw_pipeline_operacional`| Jornada completa do aluno em uma query           |
| `vw_financeiro_resumo`   | Faturamento/recebimento agrupado por mês         |
| `vw_alertas_renovacao`   | Certificados vencidos ou prestes a vencer        |
| `vw_metricas_renovacao`  | Taxa de conversão por curso e período            |

### Triggers Automáticos

| Trigger                              | Ação                                                      |
|--------------------------------------|-----------------------------------------------------------|
| `trg_matricula_historico_status`     | Grava histórico a cada mudança de status da matrícula     |
| `trg_certificado_validade`           | Calcula `data_validade` com base em `cursos.validade_meses`|
| `trg_turma_vagas`                    | Controla `vagas_disponiveis` ao matricular/desmatricular  |
| `trg_pagamento_recibo`               | Gera número de recibo sequencial ao confirmar pagamento   |
| `trg_criar_perfil_usuario`           | Cria `perfis` automaticamente ao criar usuário no Auth    |

---

## Perfis e Permissões

| Perfil       | Acesso                                                              |
|--------------|---------------------------------------------------------------------|
| `admin`      | Acesso total a todos os módulos e configurações                     |
| `comercial`  | Alunos, empresas, matrículas, financeiro, renovações, relatórios   |
| `instrutor`  | Turmas (suas), alunos matriculados, pipeline, certificados          |
| `aluno`      | Apenas seus próprios dados: matrícula, pagamento, certificado       |

---

## Etapas de Desenvolvimento

- [x] **Etapa 1** — Schema SQL, RLS, estrutura base (index.html, app.js, supabase.js, style.css)
- [ ] **Etapa 2** — CRUD Módulo Cadastros (Alunos, Instrutores, Empresas, Cursos, Turmas)
- [ ] **Etapa 3** — Pipeline Operacional (Jornada do Aluno)
- [ ] **Etapa 4** — Módulo Financeiro (Pagamentos, Recibos)
- [ ] **Etapa 5** — Certificados (Geração PDF, Validade)
- [ ] **Etapa 6** — Renovações (Alertas, CRM de Contatos)
- [ ] **Etapa 7** — Relatórios e BI (Dashboard, Métricas)
