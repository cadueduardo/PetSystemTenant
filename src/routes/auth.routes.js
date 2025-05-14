import express from 'express';
import * as authController from '../controllers/auth.controller.js';
// import { authenticateToken } from '../middleware/auth.middleware.js'; // Para rotas protegidas

const router = express.Router();

// POST /api/auth/login
router.post('/login', authController.loginUser);

// POST /api/auth/setup-password - Nova rota para configurar senha inicial do admin via token
router.post('/setup-password', authController.setupPassword);

// TODO: Add routes for logout, refresh token, etc. if needed

// router.post('/logout', authenticateToken, authController.logoutUser);

export default router; 