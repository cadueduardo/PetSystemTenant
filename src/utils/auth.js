/**
 * Obtém o ID do tenant ativo atualmente a partir do localStorage.
 * Retorna null se não encontrar.
 * 
 * TODO: Considerar buscar do Context API se o localStorage falhar ou
 *       se a informação do contexto for mais confiável.
 */
export const getCurrentTenantId = () => {
  try {
    const tenantId = localStorage.getItem('current_tenant');
    return tenantId || null; // Retorna null se for vazio ou não existir
  } catch (error) {
    console.error("Erro ao acessar localStorage para obter tenant ID:", error);
    return null; // Retorna null em caso de erro
  }
};

// Outras funções de utilidade de autenticação podem ser adicionadas aqui... 