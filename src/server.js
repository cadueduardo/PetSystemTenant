/* eslint-env node */
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Configurar dotenv para carregar o arquivo .env da raiz do projeto
const projectRootDir = process.cwd(); // Pega o diretório de onde o processo node foi iniciado
dotenv.config({ path: path.resolve(projectRootDir, '.env') });

// Import Routes
import tenantRoutes from './routes/tenant.routes.js';
import userRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js'; 
import petRoutes from './routes/pet.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import episodeRoutes from './routes/episode.routes.js';
import serviceRoutes from './routes/service.routes.js';
import productRoutes from './routes/product.routes.js';

// Import Schema for explicit model registration
import { userSchema } from './models/user.model.js';

// --- Main Server Startup Function ---
const startServer = async () => {
  try {
    // Tenta desconectar qualquer conexão existente
    // await mongoose.disconnect(); // Comentado temporariamente para evitar problemas se não houver conexão prévia

    // 1. Load Environment Variables
    const MONGO_URI = process.env.MONGO_URI;
    const TEST_VAR_FROM_ENV = process.env.TEST_VAR;
    const PORT = process.env.BACKEND_PORT || 5001;

    console.log('[DEBUG] MONGO_URI from process.env:', MONGO_URI); // Log de debug adicionado aqui
    console.log('[DEBUG] projectRootDir:', projectRootDir); // Log de debug adicionado aqui
    console.log('[DEBUG] TEST_VAR_FROM_ENV from process.env:', TEST_VAR_FROM_ENV);

    if (!MONGO_URI) {
      console.error('FATAL ERROR: MONGO_URI is not defined. Check .env file and dotenv configuration.');
      console.error('Attempted to load .env from:', path.resolve(projectRootDir, '.env'));
      process.exit(1);
    }

    try {
      // 2. Connect to MongoDB directly
      console.log(`[Startup] Attempting to connect to MongoDB at ${MONGO_URI}...`);
      await mongoose.connect(MONGO_URI);
      console.log(`[Startup] MongoDB Connection Successful! State: ${mongoose.connection.readyState}`);

      // 3. Register/Get model explicitly on this connection
      const User = mongoose.connection.model('User', userSchema);

      // --- Teste de Conexão e Modelo (REMOVER OU MANTER PARA DIAGNÓSTICO)
      // console.log('[Startup] User model obtained from explicit connection.');
      // console.log('[Startup Check] Attempting to list collections...');
      // const collections = await mongoose.connection.db.listCollections().toArray();
      // console.log('[Startup Check] Collections found:', collections.map(c => c.name));
      // console.log('[Startup Check] Attempting native find({}) on \'users\' collection...');
      // const usersNative = await mongoose.connection.db.collection('users').find({}).limit(1).toArray();
      // console.log(`[Startup Check] Native find({}) executed. Found ${usersNative.length} users.`);
      // if (usersNative.length > 0) {
      //   console.log('[Startup Check] Example user found via native driver:', usersNative[0].email);
      // }
      // --- Fim do Teste ---

      // 4. Startup Sanity Check Query using NATIVE DRIVER
      console.log(`[Startup Check] Attempting native find({}) on 'users' collection...`);
      try {
        const nativeUsers = await mongoose.connection.db.collection('users').find({}).toArray();
        console.log(`[Startup Check] Native find({}) executed. Found ${nativeUsers ? nativeUsers.length : 'null/undefined'} users.`);
        if (nativeUsers && nativeUsers.length > 0) {
            console.log('[Startup Check] Example user found via native driver:', nativeUsers[0].email);
        } else {
            console.warn('[Startup Check] No users found during native startup check!');
        }
      } catch (nativeError) {
          console.error('[Startup Check] CRITICAL ERROR during native User.find({}):', nativeError);
      }
      // --- End Native Query Check ---

      // 5. Setup Express App
      const app = express();

      // Middlewares
      app.use(cors()); 
      app.use(express.json());
      app.use(express.urlencoded({ extended: true })); 

      // API Routes
      app.use('/api/auth', authRoutes);
      app.use('/api/tenants', tenantRoutes);
      app.use('/api/users', userRoutes);
      app.use('/api/pets', petRoutes);
      app.use('/api/appointments', appointmentRoutes);
      app.use('/api/episodes', episodeRoutes);
      app.use('/api/services', serviceRoutes);
      app.use('/api/products', productRoutes);

      // Basic Root Route
      app.get('/', (req, res) => {
        res.send('PetFacil API is running...');
      });

      // Not Found Handler 
      app.use((req, res, next) => {
        const error = new Error(`Not Found - ${req.originalUrl}`);
        res.status(404);
        next(error);
      });

      // Global Error Handler
      app.use((err, req, res) => { // Removed unused 'next' parameter
        const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
        res.status(statusCode);
        console.error("Global Error Handler:", err);
        res.json({
          message: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : '🥞',
        });
      });

      // 6. Start Listening
      const server = app.listen(PORT, () => {
        console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      });

      // Handle unhandled promise rejections (outside app setup)
      process.on('unhandledRejection', (err) => {
        console.error(`Unhandled Rejection Error: ${err.message}`, err);
        server.close(() => process.exit(1));
      });

    } catch (error) {
      console.error('[Startup] FATAL ERROR during server startup:', error);
      process.exit(1);
    }
  } catch (error) {
    console.error('[Startup] FATAL ERROR during server startup:', error);
    process.exit(1);
  }
};

// --- Run the Server --- 
startServer(); 