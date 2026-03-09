-- ============================================================
-- RLS POLICIES — CORRIGIDO (v2)
-- ============================================================
-- CORREÇÕES APLICADAS:
--
-- ❌ BUG 1 — fn_get_perfil_usuario sem SET search_path
--    Função SECURITY DEFINER sem search_path retorna NULL em alguns
--    contextos do Supabase → TODAS as policies falham com 403.
--    ✅ Adicionado SET search_path = public
--
-- ❌ BUG 2 — UPDATE sem WITH CHECK (causa principal do 403 no pipeline)
--    No PostgreSQL com RLS, UPDATE precisa de:
--      USING       → filtra quais linhas o usuário pode ver/alterar
--      WITH CHECK  → valida o estado APÓS a atualização
--    Sem WITH CHECK o PostgREST/Supabase rejeita com 403.
--    ✅ Adicionado WITH CHECK em todos os UPDATE policies
--
-- ❌ BUG 3 — matriculas_historico_status sem policy de INSERT
--    O trigger fn_historico_status_matricula faz INSERT nessa tabela,
--    mas não havia policy de INSERT → 403 indireto no trigger.
--    ✅ Adicionada policy INSERT para admin/comercial/instrutor
-- ============================================================

-- ============================================================
-- FUNÇÃO AUXILIAR — CORRIGIDA com SET search_path
-- ============================================================

CREATE OR REPLACE FUNCTION fn_get_perfil_usuario()
RETURNS perfil_usuario
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT perfil FROM public.perfis WHERE id = auth.uid()
$$;

-- ============================================================
-- HABILITAR RLS
-- ============================================================

ALTER TABLE perfis                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrutores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas_historico_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados                ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos_renovacao          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- LIMPAR POLICIES ANTIGAS (seguro re-executar)
-- ============================================================

DROP POLICY IF EXISTS "perfis_select"            ON perfis;
DROP POLICY IF EXISTS "perfis_update_self"        ON perfis;
DROP POLICY IF EXISTS "perfis_insert_admin"       ON perfis;
DROP POLICY IF EXISTS "perfis_delete_admin"       ON perfis;
DROP POLICY IF EXISTS "alunos_select"             ON alunos;
DROP POLICY IF EXISTS "alunos_insert"             ON alunos;
DROP POLICY IF EXISTS "alunos_update"             ON alunos;
DROP POLICY IF EXISTS "alunos_delete"             ON alunos;
DROP POLICY IF EXISTS "empresas_select"           ON empresas;
DROP POLICY IF EXISTS "empresas_insert"           ON empresas;
DROP POLICY IF EXISTS "empresas_update"           ON empresas;
DROP POLICY IF EXISTS "empresas_delete"           ON empresas;
DROP POLICY IF EXISTS "cursos_select_all"         ON cursos;
DROP POLICY IF EXISTS "cursos_manage"             ON cursos;
DROP POLICY IF EXISTS "turmas_select"             ON turmas;
DROP POLICY IF EXISTS "turmas_insert"             ON turmas;
DROP POLICY IF EXISTS "turmas_update"             ON turmas;
DROP POLICY IF EXISTS "turmas_delete"             ON turmas;
DROP POLICY IF EXISTS "matriculas_select"         ON matriculas;
DROP POLICY IF EXISTS "matriculas_insert"         ON matriculas;
DROP POLICY IF EXISTS "matriculas_update"         ON matriculas;
DROP POLICY IF EXISTS "matriculas_delete"         ON matriculas;
DROP POLICY IF EXISTS "historico_select"          ON matriculas_historico_status;
DROP POLICY IF EXISTS "historico_insert_trigger"  ON matriculas_historico_status;
DROP POLICY IF EXISTS "pagamentos_select"         ON pagamentos;
DROP POLICY IF EXISTS "pagamentos_insert"         ON pagamentos;
DROP POLICY IF EXISTS "pagamentos_update"         ON pagamentos;
DROP POLICY IF EXISTS "pagamentos_delete"         ON pagamentos;
DROP POLICY IF EXISTS "certificados_select"       ON certificados;
DROP POLICY IF EXISTS "certificados_insert"       ON certificados;
DROP POLICY IF EXISTS "certificados_update"       ON certificados;
DROP POLICY IF EXISTS "certificados_delete"       ON certificados;
DROP POLICY IF EXISTS "renovacao_select"          ON contatos_renovacao;
DROP POLICY IF EXISTS "renovacao_insert"          ON contatos_renovacao;
DROP POLICY IF EXISTS "renovacao_update"          ON contatos_renovacao;
DROP POLICY IF EXISTS "renovacao_delete"          ON contatos_renovacao;
DROP POLICY IF EXISTS "instrutores_select"        ON instrutores;
DROP POLICY IF EXISTS "instrutores_insert"        ON instrutores;
DROP POLICY IF EXISTS "instrutores_update"        ON instrutores;
DROP POLICY IF EXISTS "instrutores_delete"        ON instrutores;

-- ============================================================
-- PERFIS
-- ============================================================

CREATE POLICY "perfis_select" ON perfis FOR SELECT USING (
  id = auth.uid()
  OR fn_get_perfil_usuario() IN ('admin', 'comercial')
);

CREATE POLICY "perfis_update_self" ON perfis FOR UPDATE
  USING      (id = auth.uid() OR fn_get_perfil_usuario() = 'admin')
  WITH CHECK (id = auth.uid() OR fn_get_perfil_usuario() = 'admin');

CREATE POLICY "perfis_insert_admin" ON perfis FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() = 'admin');

CREATE POLICY "perfis_delete_admin" ON perfis FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- ALUNOS
-- ============================================================

CREATE POLICY "alunos_select" ON alunos FOR SELECT USING (
  perfil_id = auth.uid()
  OR fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
);

CREATE POLICY "alunos_insert" ON alunos FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "alunos_update" ON alunos FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "alunos_delete" ON alunos FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- EMPRESAS
-- ============================================================

CREATE POLICY "empresas_select" ON empresas FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
);

CREATE POLICY "empresas_insert" ON empresas FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "empresas_update" ON empresas FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "empresas_delete" ON empresas FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- CURSOS
-- ============================================================

CREATE POLICY "cursos_select_all" ON cursos FOR SELECT USING (true);

CREATE POLICY "cursos_manage" ON cursos FOR ALL
  USING      (fn_get_perfil_usuario() = 'admin')
  WITH CHECK (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- TURMAS
-- ============================================================

CREATE POLICY "turmas_select" ON turmas FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
  OR EXISTS (
    SELECT 1 FROM matriculas m
    JOIN alunos a ON a.id = m.aluno_id
    WHERE m.turma_id = turmas.id AND a.perfil_id = auth.uid()
  )
);

CREATE POLICY "turmas_insert" ON turmas FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "turmas_update" ON turmas FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "turmas_delete" ON turmas FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- MATRÍCULAS  ← BUG 2 corrigido aqui
-- ============================================================

CREATE POLICY "matriculas_select" ON matriculas FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
  OR aluno_id IN (SELECT id FROM alunos WHERE perfil_id = auth.uid())
);

CREATE POLICY "matriculas_insert" ON matriculas FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

-- ✅ WITH CHECK adicionado — era a causa direta do 403 no pipeline
CREATE POLICY "matriculas_update" ON matriculas FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor'));

CREATE POLICY "matriculas_delete" ON matriculas FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- HISTÓRICO DE STATUS  ← BUG 3 corrigido aqui
-- ============================================================

CREATE POLICY "historico_select" ON matriculas_historico_status FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
  OR matricula_id IN (
    SELECT m.id FROM matriculas m
    JOIN alunos a ON a.id = m.aluno_id
    WHERE a.perfil_id = auth.uid()
  )
);

-- ✅ INSERT liberado — trigger fn_historico_status_matricula precisa disso
CREATE POLICY "historico_insert_trigger" ON matriculas_historico_status FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor'));

-- ============================================================
-- PAGAMENTOS
-- ============================================================

CREATE POLICY "pagamentos_select" ON pagamentos FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial')
  OR aluno_id IN (SELECT id FROM alunos WHERE perfil_id = auth.uid())
);

CREATE POLICY "pagamentos_insert" ON pagamentos FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "pagamentos_update" ON pagamentos FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "pagamentos_delete" ON pagamentos FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- CERTIFICADOS
-- ============================================================

CREATE POLICY "certificados_select" ON certificados FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
  OR aluno_id IN (SELECT id FROM alunos WHERE perfil_id = auth.uid())
);

CREATE POLICY "certificados_insert" ON certificados FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "certificados_update" ON certificados FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "certificados_delete" ON certificados FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- CONTATOS DE RENOVAÇÃO
-- ============================================================

CREATE POLICY "renovacao_select" ON contatos_renovacao FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial')
);

CREATE POLICY "renovacao_insert" ON contatos_renovacao FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "renovacao_update" ON contatos_renovacao FOR UPDATE
  USING      (fn_get_perfil_usuario() IN ('admin', 'comercial'))
  WITH CHECK (fn_get_perfil_usuario() IN ('admin', 'comercial'));

CREATE POLICY "renovacao_delete" ON contatos_renovacao FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');

-- ============================================================
-- INSTRUTORES
-- ============================================================

CREATE POLICY "instrutores_select" ON instrutores FOR SELECT USING (
  fn_get_perfil_usuario() IN ('admin', 'comercial', 'instrutor')
  OR perfil_id = auth.uid()
);

CREATE POLICY "instrutores_insert" ON instrutores FOR INSERT
  WITH CHECK (fn_get_perfil_usuario() = 'admin');

CREATE POLICY "instrutores_update" ON instrutores FOR UPDATE
  USING      (fn_get_perfil_usuario() = 'admin' OR perfil_id = auth.uid())
  WITH CHECK (fn_get_perfil_usuario() = 'admin' OR perfil_id = auth.uid());

CREATE POLICY "instrutores_delete" ON instrutores FOR DELETE
  USING (fn_get_perfil_usuario() = 'admin');
