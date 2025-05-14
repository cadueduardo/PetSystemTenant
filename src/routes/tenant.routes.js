import express from 'express';
import * as tenantController from '../controllers/tenant.controller.js'; // Descomentar quando o controlador for criado -> AGORA CRIADO
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js'; // Importar ambos middlewares

const router = express.Router();

// Proteger TODAS as rotas de Tenant para Super Admin

// POST /api/tenants (Create Tenant)
router.post('/', 
    authenticateToken, 
    authorizeRoles('superAdmin'), 
    tenantController.createTenant
);

// GET /api/tenants (List Tenants)
router.get('/', 
    authenticateToken, 
    authorizeRoles('superAdmin'), 
    tenantController.getTenants
);

// GET /api/tenants/:id (Get Tenant by ID)
router.get('/:id', 
    authenticateToken, 
    authorizeRoles('superAdmin'), 
    tenantController.getTenantById
);

// PUT /api/tenants/:id (Update Tenant)
router.put('/:id', 
    authenticateToken, 
    authorizeRoles('superAdmin'), 
    tenantController.updateTenant
);

// DELETE /api/tenants/:id (Delete Tenant)
router.delete('/:id', 
    authenticateToken, 
    authorizeRoles('superAdmin'), 
    tenantController.deleteTenant
);

// TODO: Adicionar outras rotas (DELETE /:id)

export default router; 