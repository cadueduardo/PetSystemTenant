import { supabase } from './supabaseClient';
import { tables } from './supabaseSchema';

// Funções para Tenants
export const TenantQueries = {
  list: async () => {
    const { data, error } = await supabase
      .from(tables.tenants.name)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  get: async (id) => {
    const { data, error } = await supabase
      .from(tables.tenants.name)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  filter: async (filters = {}) => {
    let query = supabase.from(tables.tenants.name).select('*');
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.access_url) {
      query = query.eq('access_url', filters.access_url);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (tenantData) => {
    const { data, error } = await supabase
      .from(tables.tenants.name)
      .insert([tenantData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id, tenantData) => {
    const { data, error } = await supabase
      .from(tables.tenants.name)
      .update(tenantData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase
      .from(tables.tenants.name)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Funções para Tenant Users
export const TenantUserQueries = {
  list: async () => {
    const { data, error } = await supabase
      .from(tables.tenant_users.name)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  get: async (id) => {
    const { data, error } = await supabase
      .from(tables.tenant_users.name)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  filter: async (filters = {}) => {
    let query = supabase.from(tables.tenant_users.name).select('*');
    
    if (filters.tenant_id) {
      query = query.eq('tenant_id', filters.tenant_id);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (userData) => {
    const { data, error } = await supabase
      .from(tables.tenant_users.name)
      .insert([userData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id, userData) => {
    const { data, error } = await supabase
      .from(tables.tenant_users.name)
      .update(userData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase
      .from(tables.tenant_users.name)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
}; 