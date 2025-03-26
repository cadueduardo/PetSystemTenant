import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função para obter o token de autenticação
export const getSupabaseToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}; 