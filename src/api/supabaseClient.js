// Mock do cliente Supabase que usa localStorage
const supabaseMock = {
  auth: {
    getSession: async () => {
      return {
        data: {
          session: {
            access_token: 'mock_token_' + Date.now(),
            user: {
              id: 'mock_user_id',
              email: 'mock@example.com'
            }
          }
        }
      }
    }
  },
  from: (table) => {
    return {
      select: async (query) => {
        const data = JSON.parse(localStorage.getItem(table) || '[]');
        return { data, error: null };
      },
      insert: async (data) => {
        const currentData = JSON.parse(localStorage.getItem(table) || '[]');
        const newData = [...currentData, { ...data, id: Date.now() }];
        localStorage.setItem(table, JSON.stringify(newData));
        return { data: newData, error: null };
      },
      update: async (data) => {
        const currentData = JSON.parse(localStorage.getItem(table) || '[]');
        const updatedData = currentData.map(item => 
          item.id === data.id ? { ...item, ...data } : item
        );
        localStorage.setItem(table, JSON.stringify(updatedData));
        return { data: updatedData, error: null };
      },
      delete: async (id) => {
        const currentData = JSON.parse(localStorage.getItem(table) || '[]');
        const filteredData = currentData.filter(item => item.id !== id);
        localStorage.setItem(table, JSON.stringify(filteredData));
        return { data: filteredData, error: null };
      }
    }
  }
};

export const supabase = supabaseMock;

// Função para obter o token de autenticação mock
export const getSupabaseToken = async () => {
  return 'mock_token_' + Date.now();
}; 