import express from 'express';
import * as petController from '../controllers/pet.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// All pet routes require authentication
router.use(authenticateToken);

// Create Pet 
// Only admin, collaborator (or superAdmin for potential testing/admin tasks)
router.post('/', 
    authorizeRoles('admin', 'collaborator', 'superAdmin'), 
    petController.createPet
);

// Get Pets (List)
// Accessible by all authenticated users, but controller filters by tenant/role
router.get('/', petController.getPets);

// Get Pet by ID
// Accessible by all authenticated users, but controller checks ownership/tenant
router.get('/:id', petController.getPetById);

// Update Pet by ID
// Only admin, collaborator (or superAdmin)
router.put('/:id', 
    authorizeRoles('admin', 'collaborator', 'superAdmin'), 
    petController.updatePet
);

// Delete (Inactivate) Pet by ID
// Only admin, collaborator (or superAdmin)
router.delete('/:id', 
    authorizeRoles('admin', 'collaborator', 'superAdmin'), 
    petController.inactivatePet
);

export default router; 