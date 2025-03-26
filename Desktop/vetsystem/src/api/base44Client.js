import { createClient } from '@base44/sdk';
import { uploadFileMock } from './mockData';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication
const config = {
  appId: "67d5b99d8a46835a88760aef",
  requiresAuth: true,
  config: {
    requiresAuth: true,
    getAccessToken: () => {
      // Verifica se o usuário está autenticado
      const isAuthenticated = localStorage.getItem('admin_authenticated') === 'true';
      if (!isAuthenticated) {
        throw new Error('Usuário não autenticado');
      }
      // Retorna um token mock para desenvolvimento
      return 'mock_token_' + Date.now();
    }
  }
};

const base44 = createClient(config);

// Sobrescreve o método de upload quando useMocks é true
if (!config.requiresAuth) {
  // Garante que o objeto integrationEndpoints existe
  if (!base44.integrationEndpoints) {
    base44.integrationEndpoints = {};
  }
  
  // Garante que o objeto Core existe
  if (!base44.integrationEndpoints.Core) {
    base44.integrationEndpoints.Core = {};
  }
  
  // Sobrescreve o método UploadFile
  base44.integrationEndpoints.Core.UploadFile = uploadFileMock;
}

export { base44 };
