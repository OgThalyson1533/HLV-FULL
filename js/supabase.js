// ============================================================
// supabase.js — Inicialização e cliente Supabase
// Importação via ES Modules (CDN esm.sh)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ Substitua pelas suas credenciais do projeto Supabase
// Dashboard → Project Settings → API
const SUPABASE_URL = 'https://wsfawjiqkeoilcjsehpp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gp0BJ5frZua339ZuJtiCag_XSbHtgVH';

// Singleton do cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ============================================================
// AUTH HELPERS
// ============================================================

/**
 * Retorna o usuário autenticado e o perfil completo.
 * Deve ser chamado no bootstrap do app.
 */
export async function getSessionUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;

  const { data: perfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return { user: session.user, perfil };
}

/**
 * Login com email e senha
 */
export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

/**
 * Logout
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Listener de mudança de sessão
 * callback(event, session) — event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'
 */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============================================================
// QUERY HELPERS GENÉRICOS
// ============================================================

/**
 * Busca com paginação e filtros opcionais.
 * @param {string} tabela - Nome da tabela/view
 * @param {Object} opts - { select, filters, order, page, pageSize }
 */
export async function buscar(tabela, opts = {}) {
  const {
    select = '*',
    filters = {},
    order = { coluna: 'criado_em', desc: true },
    page = 1,
    pageSize = 50,
  } = opts;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(tabela)
    .select(select, { count: 'exact' })
    .range(from, to);

  // Aplicar filtros: { campo: valor } ou { campo: { op: 'ilike', valor: '%texto%' } }
  for (const [campo, valor] of Object.entries(filters)) {
    if (valor === null || valor === undefined || valor === '') continue;
    if (typeof valor === 'object' && valor.op) {
      query = query[valor.op](campo, valor.valor);
    } else {
      query = query.eq(campo, valor);
    }
  }

  if (order) {
    query = query.order(order.coluna, { ascending: !order.desc });
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
}

/**
 * Busca um único registro por ID
 */
export async function buscarPorId(tabela, id, select = '*') {
  const { data, error } = await supabase
    .from(tabela)
    .select(select)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Inserir um ou múltiplos registros
 */
export async function inserir(tabela, dados) {
  const { data, error } = await supabase
    .from(tabela)
    .insert(dados)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualizar registro por ID
 */
export async function atualizar(tabela, id, dados) {
  const { data, error } = await supabase
    .from(tabela)
    .update(dados)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Deletar registro por ID (soft delete via campo 'ativo' quando disponível)
 */
export async function deletar(tabela, id, softDelete = true) {
  if (softDelete) {
    return atualizar(tabela, id, { ativo: false });
  }
  const { error } = await supabase.from(tabela).delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// REALTIME
// ============================================================

/**
 * Subscrever mudanças em tempo real de uma tabela
 * @returns {Function} unsubscribe function
 */
export function subscrever(tabela, callback, filtro = null) {
  let channel = supabase.channel(`realtime-${tabela}`);

  const config = {
    event: '*',
    schema: 'public',
    table: tabela,
  };

  if (filtro) config.filter = filtro;

  channel = channel.on('postgres_changes', config, callback);
  channel.subscribe();

  return () => supabase.removeChannel(channel);
}
