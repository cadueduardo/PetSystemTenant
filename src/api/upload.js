import { v4 as uuidv4 } from 'uuid';

export const uploadFile = async (file) => {
  try {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = () => {
        const base64Data = reader.result;
        resolve({
          file_url: base64Data,
          file_name: file.name
        });
      };
      
      reader.onerror = (error) => {
        console.error('Erro ao ler arquivo:', error);
        reject(new Error('Falha ao ler arquivo'));
      };
    });
  } catch (error) {
    console.error('Erro no upload do arquivo:', error);
    throw new Error('Falha ao fazer upload do arquivo');
  }
}; 