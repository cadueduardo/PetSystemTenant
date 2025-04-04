// Mock para o Core
const coreMock = {
  InvokeLLM: async (prompt) => {
    return { response: "Resposta mock do LLM" };
  },
  SendEmail: async (to, subject, body) => {
    return { success: true };
  },
  SendSMS: async (to, message) => {
    return { success: true };
  },
  UploadFile: async (fileObj) => {
    try {
      // Extrai o arquivo do objeto
      const file = fileObj.file || fileObj;
      console.log('Arquivo recebido:', file);
      console.log('Tipo do arquivo:', typeof file);
      console.log('É instância de File?', file instanceof File);
      console.log('É instância de Blob?', file instanceof Blob);
      console.log('Propriedades do arquivo:', {
        name: file?.name,
        type: file?.type,
        size: file?.size
      });

      // Verifica se o arquivo existe
      if (!file) {
        throw new Error('Nenhum arquivo foi selecionado');
      }

      // Verifica se o arquivo é uma instância de File ou Blob
      if (!(file instanceof File) && !(file instanceof Blob)) {
        throw new Error(`O arquivo selecionado não é válido. Tipo recebido: ${typeof file}`);
      }

      // Verifica se o arquivo é uma imagem
      if (!file.type?.startsWith('image/')) {
        throw new Error('O arquivo selecionado não é uma imagem');
      }

      // Converte o arquivo para base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          console.log('Imagem convertida para base64 com sucesso');
          resolve({ 
            success: true,
            url: base64String,
            key: `mock-${Date.now()}`
          });
        };
        reader.onerror = () => {
          reject(new Error('Erro ao converter a imagem'));
        };
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  GenerateImage: async (prompt) => {
    return { 
      success: true,
      url: "https://via.placeholder.com/150"
    };
  },
  ExtractDataFromUploadedFile: async (file) => {
    return { 
      success: true,
      data: "Dados extraídos mock"
    };
  }
};

export const Core = coreMock;
export const InvokeLLM = coreMock.InvokeLLM;
export const SendEmail = coreMock.SendEmail;
export const SendSMS = coreMock.SendSMS;
export const UploadFile = coreMock.UploadFile;
export const GenerateImage = coreMock.GenerateImage;
export const ExtractDataFromUploadedFile = coreMock.ExtractDataFromUploadedFile;






