import express from 'express';
import {
  createEpisodeHandler, // Handler para rota POST, se decidirmos usar
  getEpisodes,
  getEpisodeById,
  updateEpisode,
  deleteEpisode // Esta é a função de "cancelar" o episódio
} from '../controllers/episode.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Rota para criar um novo episódio diretamente (se necessário)
// Normalmente, episódios clínicos são criados quando um Appointment muda para 'Chegou'
router.post('/', 
    authenticateToken, 
    authorizeRoles(['superAdmin', 'admin', 'collaborator']), 
    createEpisodeHandler
);

// Rota para listar episódios (com filtros)
// Tutores podem listar, mas o controller deve filtrar para apenas seus pets.
router.get('/', 
    authenticateToken, 
    authorizeRoles(['superAdmin', 'admin', 'collaborator', 'tutor']), // Adicionado 'tutor' aqui
    getEpisodes
);

// Rota para buscar um episódio específico pelo ID
// Tutores podem buscar, mas o controller deve verificar se o episódio pertence a um de seus pets.
router.get('/:id', 
    authenticateToken, 
    authorizeRoles(['superAdmin', 'admin', 'collaborator', 'tutor']), // Adicionado 'tutor' aqui
    getEpisodeById
);

// Rota para atualizar um episódio
router.put('/:id', 
    authenticateToken, 
    authorizeRoles(['superAdmin', 'admin', 'collaborator']), 
    updateEpisode
);

// Rota para "cancelar" um episódio (soft delete)
router.delete('/:id', 
    authenticateToken, 
    authorizeRoles(['superAdmin', 'admin', 'collaborator']), 
    deleteEpisode
);

export default router; 