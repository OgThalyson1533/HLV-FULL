-- ============================================================
-- TRAINOS v2 — ADIÇÕES AO SCHEMA (execute APÓS o schema.sql original)
-- ============================================================

-- ── 1. TABELA DE CONFIGURAÇÕES DO SISTEMA ──────────────────
CREATE TABLE IF NOT EXISTS configuracoes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chave      TEXT NOT NULL UNIQUE,
  valor      TEXT,
  tipo       TEXT DEFAULT 'texto',
  descricao  TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir configs padrão
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('nome_escola',       'TrainOS',          'Nome da escola exibido na interface'),
  ('cnpj',              '',                 'CNPJ da escola'),
  ('endereco',          '',                 'Endereço completo'),
  ('telefone',          '',                 'Telefone de contato'),
  ('email',             '',                 'E-mail de contato'),
  ('site',              '',                 'Site da escola'),
  ('assinante_cert',    'Diretor Técnico',  'Nome que assina os certificados'),
  ('cargo_assinante',   'Diretor Técnico',  'Cargo do assinante'),
  ('texto_cert',        '',                 'Texto adicional no certificado'),
  ('url_verificacao',   '',                 'URL pública de verificação de certificados')
ON CONFLICT (chave) DO NOTHING;

-- ── 2. CAMPOS ADICIONAIS EM TABELAS EXISTENTES ─────────────

-- Instrutores: bio e assinatura
ALTER TABLE instrutores ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE instrutores ADD COLUMN IF NOT EXISTS assinatura_url TEXT;

-- Turmas: link online
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS link_online TEXT;

-- Cursos: categoria e modalidade
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS modalidade TEXT DEFAULT 'presencial';

-- ── 3. PARCELAMENTO DE PAGAMENTOS ──────────────────────────
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS parcela_atual INTEGER;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS total_parcelas INTEGER;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS pagamento_pai_id UUID REFERENCES pagamentos(id) ON DELETE SET NULL;

-- ── 4. TABELA DE LISTA DE ESPERA ───────────────────────────
CREATE TABLE IF NOT EXISTS lista_espera_turmas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id   UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  aluno_id   UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  posicao    INTEGER NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notificado BOOLEAN DEFAULT FALSE,
  UNIQUE(turma_id, aluno_id)
);

-- ── 5. NOTIFICAÇÕES ENVIADAS ───────────────────────────────
CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo            TEXT NOT NULL,  -- 'email' | 'whatsapp' | 'sistema'
  destinatario    TEXT NOT NULL,
  assunto         TEXT,
  certificado_id  UUID REFERENCES certificados(id) ON DELETE SET NULL,
  aluno_id        UUID REFERENCES alunos(id) ON DELETE SET NULL,
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_envio    TEXT DEFAULT 'enviado',  -- 'enviado' | 'erro' | 'pendente'
  erro_msg        TEXT
);

-- ── 6. VIEWS NOVAS ─────────────────────────────────────────

-- Cursos mais demandados (elimina processamento no cliente)
CREATE OR REPLACE VIEW vw_cursos_populares AS
SELECT
  c.id          AS curso_id,
  c.nome        AS curso_nome,
  c.codigo      AS curso_codigo,
  COUNT(m.id)   AS total_matriculas,
  COUNT(CASE WHEN m.status = 'em_andamento' THEN 1 END) AS em_andamento,
  COUNT(CASE WHEN m.status IN ('concluido','certificado_emitido') THEN 1 END) AS concluidos
FROM cursos c
LEFT JOIN matriculas m ON m.curso_id = c.id
WHERE c.ativo = TRUE
GROUP BY c.id, c.nome, c.codigo
ORDER BY total_matriculas DESC;

-- Fluxo de caixa futuro (parcelas a vencer)
CREATE OR REPLACE VIEW vw_fluxo_caixa AS
SELECT
  DATE_TRUNC('month', data_vencimento)     AS mes,
  SUM(valor_cobrado)                        AS total_previsto,
  COUNT(*)                                  AS qtd_cobranças,
  COUNT(CASE WHEN status = 'recebido' THEN 1 END) AS recebidos,
  SUM(CASE WHEN status = 'recebido' THEN valor_recebido ELSE 0 END) AS total_recebido
FROM pagamentos
WHERE data_vencimento IS NOT NULL
GROUP BY DATE_TRUNC('month', data_vencimento)
ORDER BY mes;

-- Inadimplência
CREATE OR REPLACE VIEW vw_inadimplencia AS
SELECT
  p.id,
  a.nome               AS aluno_nome,
  a.telefone,
  a.whatsapp,
  e.nome_fantasia      AS empresa_nome,
  c.nome               AS curso_nome,
  p.valor_cobrado,
  p.data_vencimento,
  CURRENT_DATE - p.data_vencimento AS dias_em_atraso,
  p.numero_recibo,
  p.status
FROM pagamentos p
JOIN alunos a ON a.id = p.aluno_id
JOIN matriculas mat ON mat.id = p.matricula_id
JOIN cursos c ON c.id = mat.curso_id
LEFT JOIN empresas e ON e.id = p.empresa_id
WHERE p.status IN ('pendente', 'atraso')
  AND p.data_vencimento < CURRENT_DATE
ORDER BY dias_em_atraso DESC;

-- Ocupação de turmas
CREATE OR REPLACE VIEW vw_ocupacao_turmas AS
SELECT
  t.id,
  t.codigo,
  c.nome AS curso_nome,
  t.data_inicio,
  t.data_fim,
  t.vagas_total,
  t.vagas_disponiveis,
  (t.vagas_total - t.vagas_disponiveis) AS vagas_ocupadas,
  ROUND((t.vagas_total - t.vagas_disponiveis)::NUMERIC / NULLIF(t.vagas_total, 0) * 100, 1) AS ocupacao_percent,
  t.status,
  i.nome AS instrutor_nome
FROM turmas t
JOIN cursos c ON c.id = t.curso_id
LEFT JOIN instrutores i ON i.id = t.instrutor_id;

-- ── 7. RLS PARA NOVAS TABELAS ──────────────────────────────
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar configurações"
ON configuracoes FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND perfil = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND perfil = 'admin')
);

CREATE POLICY "Todos autenticados leem configurações"
ON configuracoes FOR SELECT
TO authenticated
USING (true);

ALTER TABLE lista_espera_turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam lista de espera" ON lista_espera_turmas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin vê notificações" ON notificacoes_enviadas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND perfil IN ('admin','comercial')));

-- ── 8. ÍNDICES ADICIONAIS ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_config_chave ON configuracoes(chave);
CREATE INDEX IF NOT EXISTS idx_lista_espera_turma ON lista_espera_turmas(turma_id);
CREATE INDEX IF NOT EXISTS idx_pgto_pai ON pagamentos(pagamento_pai_id);
CREATE INDEX IF NOT EXISTS idx_pgto_vencimento_status ON pagamentos(data_vencimento, status);

-- ── 9. CONFIGS DE TEMA E LOGO (white-label) ────────────────
-- Execute este bloco se ainda não tiver as chaves de tema/logo no banco
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('logo_url',     '',         'URL ou base64 do logotipo da escola'),
  ('cor_primaria', '#00d4ff',  'Cor primária (accent) do tema'),
  ('cor_secundaria','#7c3aed', 'Cor secundária do tema'),
  ('modo_tema',    'dark',     'Modo do tema: dark ou light'),
  ('raio_borda',   '8',        'Raio de borda em pixels')
ON CONFLICT (chave) DO NOTHING;
