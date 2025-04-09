import { storage } from '@/lib/firebaseConfig'; // Importa a instância do Storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * @param {File} file - O arquivo a ser enviado.
 * @param {string} path - O caminho no Storage onde o arquivo será salvo (ex: 'pet_avatars/').
 * @returns {Promise<{success: boolean, url?: string, error?: string}>} - Objeto com status e URL ou erro.
 */
async function uploadFile(file, path = 'uploads/') {
  if (!file) {
    return { success: false, error: 'Nenhum arquivo fornecido.' };
  }

  console.log(`[Firebase Storage] Iniciando upload para: ${path}${file.name}`);

  try {
    // Cria uma referência para o local onde o arquivo será salvo
    // Adiciona timestamp ao nome para evitar sobrescritas
    const fileRef = ref(storage, `${path}${Date.now()}-${file.name}`);

    // Faz o upload do arquivo
    const snapshot = await uploadBytes(fileRef, file);
    console.log('[Firebase Storage] Upload concluído:', snapshot);

    // Obtém a URL de download pública do arquivo
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('[Firebase Storage] URL de download obtida:', downloadURL);

    return { success: true, url: downloadURL };

  } catch (error) {
    console.error('[Firebase Storage] Erro no upload:', error);
    // Tratar erros específicos do Storage se necessário (ex: permissões)
    // error.code === 'storage/unauthorized', etc.
    return { success: false, error: 'Erro ao fazer upload do arquivo.' };
  }
}

export const storageService = {
  uploadFile,
}; 