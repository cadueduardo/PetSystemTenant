/* eslint-env node */
// src/config/db.config.js

// TODO: Mover para variáveis de ambiente (.env)
// Conectando à VM da Oracle Cloud
const MONGO_URI = process.env.MONGO_URI || 'mongodb://168.75.101.234:27017/petfacil_app';

export default {
  MONGO_URI,
  // Outras configurações de DB podem ser adicionadas aqui
}; 