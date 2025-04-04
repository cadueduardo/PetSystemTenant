// Utility para gerenciar chamadas de API com retry

/**
 * Executa uma função com retry em caso de erro de rate limit
 * @param {Function} fetchFn - Função que faz a chamada à API
 * @param {number} maxRetries - Número máximo de tentativas
 * @param {number} baseDelay - Delay base entre tentativas (ms)
 * @returns {Promise<any>} - Resultado da função
 */
export const executeWithRetry = async (fetchFn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  // Verificação para garantir que fetchFn é uma função
  if (typeof fetchFn !== 'function') {
    throw new Error("fetchFn deve ser uma função");
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Se não for a primeira tentativa, esperar antes de tentar novamente
      if (attempt > 0) {
        // Calcular delay exponencial com jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Tentativa ${attempt + 1}: Aguardando ${Math.round(delay)}ms antes da próxima tentativa`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return await fetchFn();
    } catch (error) {
      console.log(`Tentativa ${attempt + 1} falhou:`, error);
      lastError = error;

      // Se não for erro de rate limit, não continuar tentando
      if (!error.message?.includes("429") && 
          !error.message?.includes("Rate limit") &&
          error.response?.status !== 429) {
        throw error;
      }
      
      // Na última tentativa, lançar o erro
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
    }
  }
  
  throw lastError;
};

/**
 * Função para esperar um tempo antes de continuar a execução
 * @param {number} ms - Tempo em milissegundos
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));