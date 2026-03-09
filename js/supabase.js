// ============================================================
// supabase.js — Cliente Supabase com melhorias de segurança
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STORAGE_URL_KEY = 'trainos_supabase_url';
const STORAGE_KEY_KEY = 'trainos_supabase_key';

export const isConfigured = () =>
  !!(localStorage.getItem(STORAGE_URL_KEY) && localStorage.getItem(STORAGE_KEY_KEY));

let _supabase = null;

function _init(url, key) {
  return createClient(url, key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
}

function getClient() {
  if (_supabase) return _supabase;
  const url = localStorage.getItem(STORAGE_URL_KEY);
  const key = localStorage.getItem(STORAGE_KEY_KEY);
  if (url && key) _supabase = _init(url, key);
  return _supabase;
}

export const supabase = new Proxy({}, {
  get(_, prop) {
    const c = getClient();
    if (!c) throw new Error('Supabase não configurado.');
    const v = c[prop];
    return typeof v === 'function' ? v.bind(c) : v;
  }
});

export function reinitClient(url, key) {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  _supabase = _init(url.trim(), key.trim());
}

export function limparCredenciais() {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_KEY_KEY);
  _supabase = null;
}

export async function getSessionUser() {
  try {
    const c = getClient();
    if (!c) return null;
    const { data: { session } } = await c.auth.getSession();
    if (!session) return null;
    const { data: perfil } = await c.from('perfis').select('*').eq('id', session.user.id).single();
    return { user: session.user, perfil };
  } catch { return null; }
}

export async function login(email, senha) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function logout() {
  await getClient().auth.signOut();
}

export function onAuthChange(callback) {
  const c = getClient();
  if (!c) return;
  return c.auth.onAuthStateChange((event, session) => callback(event, session));
}

let _configCache = null;

export async function getConfig(chave, fallback = null) {
  if (!_configCache) {
    try {
      const { data } = await getClient().from('configuracoes').select('chave,valor');
      _configCache = {};
      (data || []).forEach(c => { _configCache[c.chave] = c.valor; });
    } catch { _configCache = {}; }
  }
  return _configCache?.[chave] ?? fallback;
}

export function limparCacheConfig() { _configCache = null; }

export async function setConfig(chave, valor) {
  await getClient().from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' });
  limparCacheConfig();
}
