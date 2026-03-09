-- ============================================================
-- SISTEMA DE GESTÃO - ESCOLA DE TREINAMENTOS
-- Schema completo PostgreSQL / Supabase
-- ============================================================
-- CORREÇÕES APLICADAS:
--   1. Removido pg_cron (não disponível no plano Free/Pro padrão)
--   2. Trigger de criação de perfil reescrito com ON CONFLICT,
--      proteção contra raw_user_meta_data NULL e ENUM inválido
--   3. SET search_path adicionado à função SECURITY DEFINER
--   4. ORDER BY removido das VIEWs (incompatível com algumas versões PG)
--   5. EXCEPTION WHEN OTHERS no trigger de perfil para nunca
--      bloquear o signup do Supabase Auth
--   6. IF NOT EXISTS em todos os índices
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE perfil_usuario AS ENUM ('admin', 'comercial', 'instrutor', 'aluno');

CREATE TYPE status_aluno_turma AS ENUM (
  'matriculado',
  'aguardando_turma',
  'em_andamento',
  'concluido',
  'reprovado',
  'certificado_emitido',
  'certificado_vencido'
);

CREATE TYPE status_pagamento AS ENUM (
  'pendente',
  'recebido',
  'atraso',
  'cancelado',
  'isento'
);

CREATE TYPE tipo_pagamento AS ENUM (
  'dinheiro',
  'pix',
  'cartao_debito',
  'cartao_credito',
  'boleto',
  'transferencia',
  'faturado_empresa'
);

CREATE TYPE tipo_cliente AS ENUM ('pessoa_fisica', 'empresa');

CREATE TYPE status_turma AS ENUM (
  'agendada',
  'em_andamento',
  'concluida',
  'cancelada'
);

CREATE TYPE origem_contato AS ENUM (
  'telefone',
  'whatsapp',
  'email',
  'presencial',
  'sistema'
);

-- ============================================================
-- TABELAS BASE
-- ============================================================

-- Perfis de usuário (espelha auth.users do Supabase)
CREATE TABLE perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  perfil perfil_usuario NOT NULL DEFAULT 'aluno',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Empresas clientes (B2B)
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado CHAR(2),
  cep TEXT,
  responsavel_nome TEXT,
  responsavel_email TEXT,
  responsavel_telefone TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alunos
CREATE TABLE alunos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  endereco TEXT,
  cidade TEXT,
  estado CHAR(2),
  cep TEXT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  cargo TEXT,
  tipo_cliente tipo_cliente NOT NULL DEFAULT 'pessoa_fisica',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Instrutores
CREATE TABLE instrutores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  especialidades TEXT[],
  registro_profissional TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cursos
CREATE TABLE cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  descricao TEXT,
  carga_horaria_horas NUMERIC(5,1) NOT NULL,
  validade_meses INTEGER,
  valor_padrao NUMERIC(10,2) NOT NULL DEFAULT 0,
  norma_regulamentadora TEXT,
  conteudo_programatico TEXT,
  requisitos TEXT,
  certificado_template TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Turmas
CREATE TABLE turmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  instrutor_id UUID REFERENCES instrutores(id) ON DELETE SET NULL,
  codigo TEXT UNIQUE NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  horario_inicio TIME,
  horario_fim TIME,
  local TEXT,
  vagas_total INTEGER NOT NULL DEFAULT 20,
  vagas_disponiveis INTEGER NOT NULL DEFAULT 20,
  status status_turma NOT NULL DEFAULT 'agendada',
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT turma_datas_validas CHECK (data_fim >= data_inicio),
  CONSTRAINT vagas_validas CHECK (vagas_disponiveis <= vagas_total AND vagas_disponiveis >= 0)
);

-- ============================================================
-- MÓDULO OPERACIONAL
-- ============================================================

CREATE TABLE matriculas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  status status_aluno_turma NOT NULL DEFAULT 'matriculado',
  data_matricula TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_inicio_efetivo DATE,
  data_conclusao DATE,
  nota_final NUMERIC(4,1),
  frequencia_percent NUMERIC(5,2),
  observacoes TEXT,
  matriculado_por UUID REFERENCES perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE matriculas_historico_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  status_anterior status_aluno_turma,
  status_novo status_aluno_turma NOT NULL,
  motivo TEXT,
  alterado_por UUID REFERENCES perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO FINANCEIRO
-- ============================================================

CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE RESTRICT,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  valor_cobrado NUMERIC(10,2) NOT NULL,
  valor_recebido NUMERIC(10,2),
  desconto NUMERIC(10,2) DEFAULT 0,
  status status_pagamento NOT NULL DEFAULT 'pendente',
  tipo_pagamento tipo_pagamento,
  data_vencimento DATE,
  data_recebimento DATE,
  numero_recibo TEXT UNIQUE,
  observacoes TEXT,
  comprovante_url TEXT,
  registrado_por UUID REFERENCES perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MÓDULO DOCUMENTAL: CERTIFICADOS
-- ============================================================

CREATE TABLE certificados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE RESTRICT,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  codigo_verificacao TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(uuid_generate_v4()::TEXT, 1, 12)),
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,
  carga_horaria_horas NUMERIC(5,1) NOT NULL,
  instrutor_nome TEXT,
  pdf_url TEXT,
  emitido_por UUID REFERENCES perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cert_unique_matricula UNIQUE(matricula_id)
);

-- ============================================================
-- MÓDULO COMERCIAL: RENOVAÇÕES
-- ============================================================

CREATE TABLE contatos_renovacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificado_id UUID REFERENCES certificados(id) ON DELETE SET NULL,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  data_contato TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origem origem_contato NOT NULL DEFAULT 'telefone',
  resultado TEXT,
  proxima_acao TEXT,
  data_proxima_acao DATE,
  converteu BOOLEAN DEFAULT FALSE,
  matricula_gerada_id UUID REFERENCES matriculas(id) ON DELETE SET NULL,
  realizado_por UUID REFERENCES perfis(id) ON DELETE SET NULL,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIEWS PARA BI E RELATÓRIOS
-- ============================================================

-- Pipeline operacional completo
CREATE OR REPLACE VIEW vw_pipeline_operacional AS
SELECT
  m.id                   AS matricula_id,
  a.id                   AS aluno_id,
  a.nome                 AS aluno_nome,
  a.cpf                  AS aluno_cpf,
  a.telefone             AS aluno_telefone,
  a.whatsapp             AS aluno_whatsapp,
  e.id                   AS empresa_id,
  e.nome_fantasia        AS empresa_nome,
  c.id                   AS curso_id,
  c.nome                 AS curso_nome,
  c.codigo               AS curso_codigo,
  c.carga_horaria_horas,
  t.id                   AS turma_id,
  t.codigo               AS turma_codigo,
  t.data_inicio          AS turma_inicio,
  t.data_fim             AS turma_fim,
  i.nome                 AS instrutor_nome,
  m.status,
  m.data_matricula,
  m.data_conclusao,
  m.nota_final,
  m.frequencia_percent,
  cert.codigo_verificacao AS certificado_codigo,
  cert.data_emissao      AS cert_emissao,
  cert.data_validade     AS cert_validade,
  CASE
    WHEN cert.data_validade IS NOT NULL AND cert.data_validade < CURRENT_DATE
      THEN 'vencido'
    WHEN cert.data_validade IS NOT NULL AND cert.data_validade <= CURRENT_DATE + INTERVAL '60 days'
      THEN 'a_vencer_60d'
    WHEN cert.data_validade IS NOT NULL AND cert.data_validade <= CURRENT_DATE + INTERVAL '90 days'
      THEN 'a_vencer_90d'
    WHEN cert.data_validade IS NOT NULL
      THEN 'valido'
    ELSE 'sem_validade'
  END AS status_certificado
FROM matriculas m
JOIN  alunos a     ON a.id    = m.aluno_id
JOIN  cursos c     ON c.id    = m.curso_id
LEFT JOIN turmas t ON t.id    = m.turma_id
LEFT JOIN instrutores i ON i.id = t.instrutor_id
LEFT JOIN empresas e    ON e.id = a.empresa_id
LEFT JOIN certificados cert ON cert.matricula_id = m.id;

-- Resumo financeiro por mês
CREATE OR REPLACE VIEW vw_financeiro_resumo AS
SELECT
  DATE_TRUNC('month', p.criado_em)                                              AS mes,
  COUNT(*)                                                                       AS total_pagamentos,
  SUM(p.valor_cobrado)                                                           AS total_cobrado,
  SUM(CASE WHEN p.status = 'recebido' THEN p.valor_recebido ELSE 0 END)        AS total_recebido,
  SUM(CASE WHEN p.status = 'pendente' THEN p.valor_cobrado  ELSE 0 END)        AS total_pendente,
  SUM(CASE WHEN p.status = 'atraso'   THEN p.valor_cobrado  ELSE 0 END)        AS total_em_atraso,
  COUNT(CASE WHEN p.status = 'recebido' THEN 1 END)                             AS qtd_recebidos,
  COUNT(CASE WHEN p.status = 'pendente' THEN 1 END)                             AS qtd_pendentes,
  COUNT(CASE WHEN p.status = 'atraso'   THEN 1 END)                             AS qtd_em_atraso
FROM pagamentos p
GROUP BY DATE_TRUNC('month', p.criado_em);

-- Alertas de renovação (certificados vencidos ou a vencer em 90 dias)
CREATE OR REPLACE VIEW vw_alertas_renovacao AS
SELECT
  cert.id              AS certificado_id,
  a.id                 AS aluno_id,
  a.nome               AS aluno_nome,
  a.telefone,
  a.whatsapp,
  a.email,
  e.id                 AS empresa_id,
  e.nome_fantasia      AS empresa_nome,
  e.responsavel_nome,
  e.responsavel_telefone,
  c.id                 AS curso_id,
  c.nome               AS curso_nome,
  c.codigo             AS curso_codigo,
  cert.data_emissao,
  cert.data_validade,
  (CURRENT_DATE - cert.data_validade) AS dias_vencido,
  CASE
    WHEN cert.data_validade <  CURRENT_DATE                               THEN 'vencido'
    WHEN cert.data_validade <= CURRENT_DATE + INTERVAL '30 days'         THEN 'critico_30d'
    WHEN cert.data_validade <= CURRENT_DATE + INTERVAL '60 days'         THEN 'atencao_60d'
    WHEN cert.data_validade <= CURRENT_DATE + INTERVAL '90 days'         THEN 'aviso_90d'
    ELSE NULL
  END AS nivel_alerta,
  (
    SELECT MAX(cr.data_contato)
    FROM contatos_renovacao cr
    WHERE cr.certificado_id = cert.id
  ) AS ultimo_contato
FROM certificados cert
JOIN  alunos  a ON a.id = cert.aluno_id
JOIN  cursos  c ON c.id = cert.curso_id
LEFT JOIN empresas e ON e.id = a.empresa_id
WHERE cert.data_validade IS NOT NULL
  AND cert.data_validade <= CURRENT_DATE + INTERVAL '90 days';

-- Métricas de conversão de renovação
CREATE OR REPLACE VIEW vw_metricas_renovacao AS
SELECT
  c.nome                                                                AS curso_nome,
  COUNT(cr.id)                                                          AS total_contatos,
  COUNT(CASE WHEN cr.converteu THEN 1 END)                             AS total_convertidos,
  ROUND(
    COUNT(CASE WHEN cr.converteu THEN 1 END)::NUMERIC
      / NULLIF(COUNT(cr.id), 0) * 100, 2
  )                                                                     AS taxa_conversao_percent,
  DATE_TRUNC('month', cr.data_contato)                                 AS mes
FROM contatos_renovacao cr
JOIN cursos c ON c.id = cr.curso_id
GROUP BY c.nome, DATE_TRUNC('month', cr.data_contato);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_perfis_atualizado      BEFORE UPDATE ON perfis      FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_alunos_atualizado      BEFORE UPDATE ON alunos      FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_instrutores_atualizado BEFORE UPDATE ON instrutores  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_cursos_atualizado      BEFORE UPDATE ON cursos       FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_turmas_atualizado      BEFORE UPDATE ON turmas       FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_matriculas_atualizado  BEFORE UPDATE ON matriculas   FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_pagamentos_atualizado  BEFORE UPDATE ON pagamentos   FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();
CREATE TRIGGER trg_empresas_atualizado    BEFORE UPDATE ON empresas     FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- Gravar histórico ao mudar status da matrícula
CREATE OR REPLACE FUNCTION fn_historico_status_matricula()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO matriculas_historico_status (matricula_id, status_anterior, status_novo)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_matricula_historico_status
AFTER UPDATE ON matriculas
FOR EACH ROW EXECUTE FUNCTION fn_historico_status_matricula();

-- Calcular data_validade do certificado automaticamente
CREATE OR REPLACE FUNCTION fn_calcular_validade_certificado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_validade_meses INTEGER;
BEGIN
  SELECT validade_meses INTO v_validade_meses FROM cursos WHERE id = NEW.curso_id;
  IF v_validade_meses IS NOT NULL THEN
    NEW.data_validade = NEW.data_emissao + (v_validade_meses || ' months')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certificado_validade
BEFORE INSERT OR UPDATE ON certificados
FOR EACH ROW EXECUTE FUNCTION fn_calcular_validade_certificado();

-- Controlar vagas_disponiveis da turma
CREATE OR REPLACE FUNCTION fn_atualizar_vagas_turma()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.turma_id IS NOT NULL THEN
    UPDATE turmas SET vagas_disponiveis = vagas_disponiveis - 1
    WHERE id = NEW.turma_id AND vagas_disponiveis > 0;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.turma_id IS NOT NULL AND OLD.turma_id IS DISTINCT FROM NEW.turma_id THEN
      UPDATE turmas SET vagas_disponiveis = vagas_disponiveis + 1 WHERE id = OLD.turma_id;
    END IF;
    IF NEW.turma_id IS NOT NULL AND OLD.turma_id IS DISTINCT FROM NEW.turma_id THEN
      UPDATE turmas SET vagas_disponiveis = vagas_disponiveis - 1
      WHERE id = NEW.turma_id AND vagas_disponiveis > 0;
    END IF;

  ELSIF TG_OP = 'DELETE' AND OLD.turma_id IS NOT NULL THEN
    UPDATE turmas SET vagas_disponiveis = vagas_disponiveis + 1 WHERE id = OLD.turma_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_turma_vagas
AFTER INSERT OR UPDATE OR DELETE ON matriculas
FOR EACH ROW EXECUTE FUNCTION fn_atualizar_vagas_turma();

-- Gerar número de recibo sequencial
CREATE OR REPLACE FUNCTION fn_gerar_numero_recibo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  IF NEW.numero_recibo IS NULL AND NEW.status = 'recebido' THEN
    SELECT COUNT(*) + 1 INTO v_seq FROM pagamentos WHERE status = 'recebido';
    NEW.numero_recibo = 'REC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pagamento_recibo
BEFORE INSERT OR UPDATE ON pagamentos
FOR EACH ROW EXECUTE FUNCTION fn_gerar_numero_recibo();

-- ============================================================
-- TRIGGER DE CRIAÇÃO DE PERFIL — CORRIGIDO
-- ============================================================
-- Problemas corrigidos:
--   ✅ raw_user_meta_data NULL-safe (COALESCE com '{}')
--   ✅ ENUM cast protegido com CASE/WHEN (evita erro com valor inválido)
--   ✅ ON CONFLICT (id) DO UPDATE — não falha no re-invite ou duplicata
--   ✅ EXCEPTION WHEN OTHERS — NUNCA bloqueia o signup do Auth
--   ✅ SET search_path = public (obrigatório em SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_criar_perfil_novo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome   TEXT;
  v_perfil perfil_usuario;
  v_meta   JSONB;
BEGIN
  -- Metadata pode ser NULL no fluxo de convite (invite flow)
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);

  -- Nome: tenta várias fontes antes de usar o email
  v_nome := COALESCE(
    NULLIF(TRIM(v_meta->>'nome'), ''),
    NULLIF(TRIM(v_meta->>'full_name'), ''),
    NULLIF(TRIM(v_meta->>'name'), ''),
    SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)
  );

  -- Perfil: valida antes do cast para evitar exceção de ENUM
  v_perfil := CASE
    WHEN (v_meta->>'perfil') IN ('admin', 'comercial', 'instrutor', 'aluno')
      THEN (v_meta->>'perfil')::perfil_usuario
    ELSE 'aluno'::perfil_usuario
  END;

  INSERT INTO public.perfis (id, nome, email, perfil)
  VALUES (NEW.id, v_nome, NEW.email, v_perfil)
  ON CONFLICT (id) DO UPDATE
    SET nome          = EXCLUDED.nome,
        email         = EXCLUDED.email,
        atualizado_em = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Loga o aviso mas NUNCA bloqueia o signup
  RAISE WARNING '[TrainOS] fn_criar_perfil_novo_usuario falhou para %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_perfil_usuario ON auth.users;

CREATE TRIGGER trg_criar_perfil_usuario
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION fn_criar_perfil_novo_usuario();

-- ============================================================
-- FUNÇÃO UTILITÁRIA: atualizar certificados vencidos
-- Chame manualmente via SQL Editor ou agende no Supabase Dashboard
-- (Database > Cron Jobs) se pg_cron estiver habilitado no seu plano.
-- Exemplo de agendamento:
--   SELECT cron.schedule('atualizar-certs-vencidos', '0 3 * * *',
--     'SELECT fn_atualizar_status_certificados_vencidos();');
-- ============================================================
CREATE OR REPLACE FUNCTION fn_atualizar_status_certificados_vencidos()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE matriculas m
  SET    status = 'certificado_vencido'
  FROM   certificados c
  WHERE  c.matricula_id = m.id
    AND  c.data_validade < CURRENT_DATE
    AND  m.status = 'certificado_emitido';
END;
$$;

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_matriculas_aluno      ON matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma      ON matriculas(turma_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso      ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_status     ON matriculas(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_matricula  ON pagamentos(matricula_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status     ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_vencimento ON pagamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_certificados_aluno    ON certificados(aluno_id);
CREATE INDEX IF NOT EXISTS idx_certificados_validade ON certificados(data_validade);
CREATE INDEX IF NOT EXISTS idx_certificados_codigo   ON certificados(codigo_verificacao);
CREATE INDEX IF NOT EXISTS idx_alunos_empresa        ON alunos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alunos_cpf            ON alunos(cpf);
CREATE INDEX IF NOT EXISTS idx_turmas_curso          ON turmas(curso_id);
CREATE INDEX IF NOT EXISTS idx_turmas_status         ON turmas(status);
CREATE INDEX IF NOT EXISTS idx_contatos_aluno        ON contatos_renovacao(aluno_id);
CREATE INDEX IF NOT EXISTS idx_contatos_cert         ON contatos_renovacao(certificado_id);

-- ============================================================
-- FUNÇÃO RPC: promover_usuario_admin
-- Permite que o primeiro usuário se auto-promova a admin.
-- Chamada via supabase.rpc('promover_usuario_admin', { user_id })
-- SECURITY DEFINER ignora RLS — só promove se for o único usuário
-- ou se ainda não existir nenhum admin no sistema.
-- ============================================================
CREATE OR REPLACE FUNCTION promover_usuario_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_usuarios INTEGER;
  v_total_admins   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_usuarios FROM perfis;
  SELECT COUNT(*) INTO v_total_admins   FROM perfis WHERE perfil = 'admin';

  -- Só promove se: for o único usuário OU não existir nenhum admin ainda
  IF v_total_usuarios = 1 OR v_total_admins = 0 THEN
    UPDATE perfis SET perfil = 'admin' WHERE id = user_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
