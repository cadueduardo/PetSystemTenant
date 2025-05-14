/* eslint-env node */
// src/config/database.js
import mongoose from 'mongoose';
import dbConfig from './db.config.js';

const connectDB = async () => {
  try {
    await mongoose.connect(dbConfig.MONGO_URI, {
      // Opções recomendadas para evitar warnings
      // useNewUrlParser: true, // Não é mais necessário na v6+
      // useUnifiedTopology: true, // Não é mais necessário na v6+
    });
    console.log('MongoDB conectado com sucesso!');
  } catch (err) {
    console.error('Erro ao conectar ao MongoDB:', err.message);
    // Sair do processo com falha
    process.exit(1);
  }
};

export default connectDB; 