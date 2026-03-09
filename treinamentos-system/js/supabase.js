// ============================================================
// supabase.js — Inicialização e cliente Supabase
// As credenciais são lidas do localStorage (configuradas na tela de setup)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Lê credenciais salvas pelo usuário (tela de configuração)
const SUPABASE_URL     = localStorage.getItem('hlv_supabase_url')     || '';
const SUPABASE_ANON_KEY = localStorage.getItem('hlv_supabase_key')    || '';

// Flag global para verificar se está configurado
export const isConfigured = () =>
  !!(localStorage.getItem('hlv_supabase_url') && localStorage.getItem('hlv_supabase_key'));

// Singleton do cliente (recriado quando configuração muda)
export let supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null;

/** Reinicializa o cliente após salvar credenciais */
export function reinitClient(url, key) {
  localStorage.setItem('hlv_supabase_url', url.trim());
  localStorage.setItem('hlv_supabase_key', key.trim());
  supabase = createClient(url.trim(), key.trim(), {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
}

// ============================================================
// AUTH HELPERS
// ============================================================

export async function getSessionUser() {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;

  const { data: perfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return { user: session.user, perfil };
}

export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============================================================
// QUERY HELPERS GENÉRICOS
// ============================================================

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

export async function buscarPorId(tabela, id, select = '*') {
  const { data, error } = await supabase
    .from(tabela)
    .select(select)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function inserir(tabela, dados) {
  const { data, error } = await supabase
    .from(tabela)
    .insert(dados)
    .select()
    .single();
  if (error) throw error;
  return data;
}

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

export function subscrever(tabela, callback, filtro = null) {
  let channel = supabase.channel(`realtime-${tabela}`);
  const config = { event: '*', schema: 'public', table: tabela };
  if (filtro) config.filter = filtro;
  channel = channel.on('postgres_changes', config, callback);
  channel.subscribe();
  return () => supabase.removeChannel(channel);
}
