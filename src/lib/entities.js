import { supabase, checkAuth } from './base44Client'

// Função para criar um novo tenant
export const createTenant = async (tenantData) => {
  try {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('tenants')
      .insert([tenantData])
      .select()
    
    if (error) throw error
    return data[0]
  } catch (error) {
    console.error('Erro ao criar tenant:', error)
    throw error
  }
}

// Função para buscar todos os tenants
export const getTenants = async () => {
  try {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao buscar tenants:', error)
    throw error
  }
}

// Função para buscar um tenant específico
export const getTenantById = async (accessUrl) => {
  try {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('access_url', accessUrl)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Erro ao buscar tenant específico:', error)
    throw error
  }
}

// Função para atualizar um tenant
export const updateTenant = async (accessUrl, tenantData) => {
  try {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('tenants')
      .update(tenantData)
      .eq('access_url', accessUrl)
      .select()
    
    if (error) throw error
    return data[0]
  } catch (error) {
    console.error('Erro ao atualizar tenant:', error)
    throw error
  }
}

// Função para deletar um tenant
export const deleteTenant = async (accessUrl) => {
  try {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      throw new Error('Usuário não autenticado')
    }

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('access_url', accessUrl)
    
    if (error) throw error
  } catch (error) {
    console.error('Erro ao deletar tenant:', error)
    throw error
  }
}

// Função para validar se um tenant existe
export const validateTenant = async (accessUrl) => {
  try {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      throw new Error('Usuário não autenticado')
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('access_url', accessUrl)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return false // Tenant não encontrado
      }
      throw error
    }
    return !!data
  } catch (error) {
    console.error('Erro ao validar tenant:', error)
    throw error
  }
} 