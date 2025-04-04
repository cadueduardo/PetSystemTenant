import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Função para verificar se o usuário está autenticado
export const checkAuth = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Erro ao verificar autenticação:', error)
      return false
    }
    
    if (!session) {
      console.log('Nenhuma sessão ativa')
      return false
    }

    console.log('Sessão ativa:', session)
    return true
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error)
    return false
  }
}

// Função para fazer login
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) {
      console.error('Erro ao fazer login:', error)
      throw error
    }
    console.log('Login bem sucedido:', data)
    return data
  } catch (error) {
    console.error('Erro ao fazer login:', error)
    throw error
  }
}

// Função para fazer logout
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Erro ao fazer logout:', error)
      throw error
    }
    console.log('Logout bem sucedido')
  } catch (error) {
    console.error('Erro ao fazer logout:', error)
    throw error
  }
}

// Função para verificar o estado atual da autenticação
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Erro ao obter usuário:', error)
      return null
    }
    return user
  } catch (error) {
    console.error('Erro ao obter usuário:', error)
    return null
  }
}

// Função para registrar um novo usuário
export const signUp = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) {
      console.error('Erro ao registrar usuário:', error)
      throw error
    }
    console.log('Registro bem sucedido:', data)
    return data
  } catch (error) {
    console.error('Erro ao registrar usuário:', error)
    throw error
  }
} 