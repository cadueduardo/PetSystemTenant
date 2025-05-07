import cors from 'cors';

// --- Configuração CORS ---
// Configura o CORS para permitir as origens do seu frontend (local e produção)
export const corsHandler = cors({ origin: ["http://localhost:5173", "https://petfacil.app"] }); 