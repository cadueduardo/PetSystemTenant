import express from 'express';
import * as serviceController from '../controllers/service.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware de autenticação aplicado a todas as rotas de serviços
router.use(authenticateToken);

// --- Rotas CRUD para Services --- 

// POST /api/services (Criar serviço)
// Apenas Admin do tenant pode criar
router.post('/', 
    authorizeRoles('admin'), 
    serviceController.createService
);

// GET /api/services (Listar serviços com filtros)
// Admin e Collaborator podem listar (para selecionar em agendamentos, OS, etc)
router.get('/', 
    authorizeRoles('admin', 'collaborator'),
    serviceController.getServices
);

// GET /api/services/:id (Buscar serviço por ID)
// Admin e Collaborator podem ver detalhes
router.get('/:id', 
    authorizeRoles('admin', 'collaborator'),
    serviceController.getServiceById
);

// PUT /api/services/:id (Atualizar serviço por ID)
// Apenas Admin do tenant pode atualizar
router.put('/:id', 
    authorizeRoles('admin'),
    serviceController.updateService
);

// DELETE /api/services/:id (Inativar serviço por ID)
// Apenas Admin do tenant pode inativar
router.delete('/:id', 
    authorizeRoles('admin'),
    serviceController.deleteService // Marcar como inativo
);

export default router; 