import express from 'express';
import * as appointmentController from '../controllers/appointment.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware de autenticação aplicado a todas as rotas de appointments
router.use(authenticateToken);

// --- Rotas CRUD para Appointments --- 

// POST /api/appointments (Criar agendamento)
// TODO: Definir roles permitidas (admin, collaborator?)
router.post('/', 
    authorizeRoles('admin', 'collaborator'), // Exemplo: Admin e Colaborador podem criar
    appointmentController.createAppointment
);

// GET /api/appointments (Listar agendamentos com filtros)
// TODO: Definir roles permitidas (admin, collaborator?)
router.get('/', 
    authorizeRoles('admin', 'collaborator'), // Exemplo: Admin e Colaborador podem listar
    appointmentController.getAppointments
);

// GET /api/appointments/:id (Buscar agendamento por ID)
// TODO: Definir roles permitidas (admin, collaborator?)
router.get('/:id', 
    authorizeRoles('admin', 'collaborator'), // Exemplo: Admin e Colaborador podem ver
    appointmentController.getAppointmentById
);

// PUT /api/appointments/:id (Atualizar agendamento por ID)
// TODO: Definir roles permitidas (admin, collaborator?)
router.put('/:id', 
    authorizeRoles('admin', 'collaborator'), // Exemplo: Admin e Colaborador podem atualizar
    appointmentController.updateAppointment
);

// DELETE /api/appointments/:id (Cancelar/Deletar agendamento por ID)
// TODO: Definir roles permitidas (admin, collaborator?)
router.delete('/:id', 
    authorizeRoles('admin', 'collaborator'), // Exemplo: Admin e Colaborador podem deletar/cancelar
    appointmentController.deleteAppointment
);

export default router; 