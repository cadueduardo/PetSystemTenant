import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tenant } from '@/api/entities';

// Criar contexto do tenant
const TenantContext = createContext(null);

// Componente Provider
export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Carregar tenant da URL ou do tenant ativo
    const loadTenant = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Verificar parâmetro de loja na URL
        const urlParams = new URLSearchParams(window.location.search);
        const storeParam = urlParams.get('store');

        if (storeParam) {
          // Buscar tenant pelo slug da URL
          const tenantsByUrl = await Tenant.filter({ access_url: storeParam, status: "active" });
          
          if (tenantsByUrl.length > 0) {
            setCurrentTenant(tenantsByUrl[0]);
            console.log(`TenantContext - Tenant carregado da URL: ${storeParam}`, tenantsByUrl[0]);
          } else {
            setError(`Tenant não encontrado: ${storeParam}`);
          }
        } else {
          // Buscar qualquer tenant ativo para o usuário
          const tenantsData = await Tenant.filter({ status: "active" });
          
          if (tenantsData.length > 0) {
            setCurrentTenant(tenantsData[0]);
            console.log('TenantContext - Tenant ativo carregado:', tenantsData[0]);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar tenant:', err);
        setError('Não foi possível carregar os dados do tenant.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  // Função para alterar tenant atual (para administradores que gerenciam múltiplos tenants)
  const switchTenant = async (tenantId) => {
    try {
      setIsLoading(true);
      const tenant = await Tenant.filter({ id: tenantId, status: "active" });
      
      if (tenant.length > 0) {
        setCurrentTenant(tenant[0]);
        
        // Atualizar URL para refletir o tenant atual
        if (tenant[0].access_url) {
          const url = new URL(window.location.href);
          url.searchParams.set('store', tenant[0].access_url);
          window.history.pushState({}, '', url);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao trocar tenant:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantContext.Provider value={{ 
      currentTenant, 
      isLoading, 
      error,
      switchTenant 
    }}>
      {children}
    </TenantContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser usado dentro de um TenantProvider");
  }
  return context;
}