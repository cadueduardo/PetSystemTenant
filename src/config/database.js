/* eslint-env node */
// src/config/database.js
import mongoose from 'mongoose';
// import dbConfig from './db.config.js'; // Removido

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('Erro Crítico: MONGODB_URI não está definida nas variáveis de ambiente.');
      console.error('Certifique-se de que seu arquivo .env está correto e carregado.');
      process.exit(1);
    }
    console.log('DEBUG: Tentando conectar com MONGODB_URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, { // Alterado para usar process.env.MONGODB_URI
      // Opções recomendadas para evitar warnings
      // useNewUrlParser: true, // Não é mais necessário na v6+
      // useUnifiedTopology: true, // Não é mais necessário na v6+
    });
    console.log('MongoDB conectado com sucesso usando MONGODB_URI do .env!');
  } catch (err) {
    console.error('Erro ao conectar ao MongoDB:', err.message);
    // Sair do processo com falha
    process.exit(1);
  }
};

export default connectDB; 