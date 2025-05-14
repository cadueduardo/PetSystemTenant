import express from 'express';
import * as productController from '../controllers/product.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware de autenticação aplicado a todas as rotas de produtos
router.use(authenticateToken);

// --- Rotas CRUD para Products --- 

// POST /api/products (Criar produto)
// Apenas Admin do tenant pode criar
router.post('/', 
    authorizeRoles('admin'), 
    productController.createProduct
);

// GET /api/products (Listar produtos com filtros)
// Admin e Collaborator podem listar
router.get('/', 
    authorizeRoles('admin', 'collaborator'),
    productController.getProducts
);

// GET /api/products/:id (Buscar produto por ID)
// Admin e Collaborator podem ver detalhes
router.get('/:id', 
    authorizeRoles('admin', 'collaborator'),
    productController.getProductById
);

// PUT /api/products/:id (Atualizar produto por ID)
// Apenas Admin do tenant pode atualizar
router.put('/:id', 
    authorizeRoles('admin'),
    productController.updateProduct
);

// DELETE /api/products/:id (Inativar produto por ID)
// Apenas Admin do tenant pode inativar (soft delete)
router.delete('/:id', 
    authorizeRoles('admin'),
    productController.deleteProduct // Deve implementar soft delete (marcar como inativo)
);

// TODO: Considerar rota para consulta por barcode/SKU?
// GET /api/products/lookup?barcode=12345 
// GET /api/products/lookup?sku=XYZ

export default router; 