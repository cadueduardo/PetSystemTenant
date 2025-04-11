// Mapeamento de nomes de página para rotas específicas
const routeMappings: Record<string, string> = {
    AppointmentForm: '/tenant/agendamento/novo',
    EditAppointment: '/tenant/agendamento/editar/:id',
    PetDetails: '/tenant/pet/:id',
    CustomerDetails: '/tenant/cliente/:id',
    LiveVetConsulta: '/tenant/live-vet/consulta/:appointmentId',
    // Adicione outros mapeamentos conforme necessário
    // Exemplo: MedicalRecordForm: '/tenant/prontuario/novo'
};

export function createPageUrl(pageName: string, params?: Record<string, string | number | undefined | null>): string {
    let basePath: string;

    // Remove o parâmetro store do pageName se ele estiver presente
    if (pageName.includes('?store=')) {
        pageName = pageName.split('?store=')[0];
    }

    // Verifica se há um mapeamento específico para o pageName
    if (routeMappings[pageName]) {
        basePath = routeMappings[pageName];
    } else {
        // Lógica padrão se não houver mapeamento
        basePath = pageName.toLowerCase().replace(/ /g, '-'); // Aplica toLowerCase inicialmente

        if (!basePath.startsWith('/')) {
            basePath = '/' + basePath;
        }
        // Adiciona o prefixo /tenant/ se necessário
        const specialRoutes = ['/admin', '/adminlogin', '/admindashboard', '/'];
        if (!basePath.startsWith('/tenant/') && !specialRoutes.some(route => basePath.startsWith(route))) {
            basePath = '/tenant' + basePath;
        }
    }
    
    // Processa parâmetros da rota (:id, etc.)
    let finalUrl = basePath;
    const remainingParams: Record<string, string> = {}; 

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            const placeholder = `:${key}`;
            if (value !== undefined && value !== null && finalUrl.includes(placeholder)) {
                finalUrl = finalUrl.replace(placeholder, String(value));
            } else if (value !== undefined && value !== null) {
                // Guarda os parâmetros que não foram usados na rota para a query string
                remainingParams[key] = String(value);
            }
        });
    }

    // Inicializa os parâmetros de query com os params restantes
    const queryParams = new URLSearchParams(remainingParams);

    // Tratamento do 'store' (garante que seja adicionado apenas uma vez)
    let currentStore: string | null = null;
    if (typeof window !== 'undefined') { // Verifica se está no ambiente do navegador
        const tenantFromStorage = localStorage.getItem('current_tenant');
        const currentUrlParams = new URLSearchParams(window.location.search);
        const tenantFromUrl = currentUrlParams.get('store');
        currentStore = tenantFromUrl || tenantFromStorage;
        
        // Remove 'store' dos parâmetros iniciais se ele veio da URL/storage, para evitar duplicidade
        if (currentStore && queryParams.has('store')) {
             if (queryParams.get('store') === currentStore) {
                 // Se o store já está correto, não faz nada ou remove para adicionar depois
                 // Optamos por remover para garantir que a fonte (URL/Storage) tenha precedência
                 queryParams.delete('store'); 
             } else {
                 // Se o store nos params é DIFERENTE do URL/Storage, mantém o dos params (decisão de prioridade)
                 // Neste caso, não setaremos o currentStore abaixo
                 currentStore = null; 
             }
        }
        
        // Adiciona o parâmetro 'store' obtido da URL/Storage, se aplicável
        if (currentStore) {
            queryParams.set('store', currentStore);
        }
    } else {
      // Ambiente de servidor (SSR) - tenta usar 'store' dos params se existir
      if (queryParams.has('store')) {
         currentStore = queryParams.get('store');
      }
    }
    
    // Constrói a string de query final
    const queryString = queryParams.toString();

    // Adiciona a query string à URL se houver parâmetros
    if (queryString) {
        finalUrl += '?' + queryString;
    }

    console.log(`[createPageUrl] Gerada: ${finalUrl} (pageName: ${pageName}, params: ${JSON.stringify(params)}, store: ${currentStore})`);

    return finalUrl;
}
