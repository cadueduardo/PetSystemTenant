import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
// import { authorizeRoles } from '../middleware/auth.middleware.js'; // Importar depois

const router = express.Router();

// TODO: Add authentication and authorization middleware

// Create User
router.post('/', 
    authenticateToken, 
    authorizeRoles('superAdmin', 'admin'), // Somente SuperAdmin e Admin podem tentar criar
    userController.createUser
);

// Get Users (List)
router.get('/', 
    authenticateToken, 
    authorizeRoles('superAdmin', 'admin'), // Somente SuperAdmin e Admin podem listar
    userController.getUsers
);

// Get User by ID
// Qualquer usuário autenticado pode tentar, o controller fará a lógica de permissão
router.get('/:id', 
    authenticateToken, 
    userController.getUserById
);

// Update User by ID
// Qualquer usuário autenticado pode tentar, o controller fará a lógica de permissão
router.put('/:id', 
    authenticateToken, 
    userController.updateUser
);

// Delete (Inactivate) User by ID
router.delete('/:id', 
    authenticateToken, 
    authorizeRoles('superAdmin', 'admin'), // Somente SuperAdmin e Admin podem tentar deletar
    userController.deleteUser
);

// Rota para Super Admin definir/resetar senha de um usuário
router.put(
    '/:userId/set-password',
    authenticateToken,
    authorizeRoles('superAdmin'),
    userController.setUserPassword // Nova função no controller
);

// TODO: Add routes for invitation flow, password reset, etc.
// router.post('/invite', authenticate, authorize('admin'), userController.inviteUser);
// router.post('/complete-invitation', userController.completeInvitation);
// router.post('/forgot-password', userController.forgotPassword);
// router.post('/reset-password/:token', userController.resetPassword);

export default router; 