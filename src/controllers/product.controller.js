import Product from '../models/product.model.js';
import mongoose from 'mongoose';

// Helper function for consistent error handling
const handleProductError = (res, error, context) => {
  console.error(`Error ${context}:`, error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: `Erro de validação ao ${context}.`, errors: error.errors });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: `Conflito de dados ao ${context}. Verifique campos únicos como SKU ou código de barras.`, error: error.keyValue });
  }
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: 'ID inválido fornecido.' });
  }
  return res.status(500).json({ success: false, message: `Erro interno ao ${context}.`, error: error.message });
};

// Helper function to safely parse float or return null
const safeParseFloat = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

// Helper function to safely parse int or return a default value (e.g., 0)
const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return defaultValue; // Or null if preferred for truly optional integers that aren't quantities
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// --- POST /api/products --- (Create Product)
export const createProduct = async (req, res) => {
  console.log("Received request to create product:", req.body);
  const tenant_id = req.user.tenant_id;

  if (!tenant_id || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Apenas administradores de tenant podem criar produtos.' });
  }

  const {
    name, description, sku, barcode, category, ncm, module, // module from ProductForm.jsx
    stock_quantity, low_stock_threshold, // from ProductForm.jsx
    cost_price, price, // price from ProductForm.jsx
    image_url, allowInternalUse, administrationPrice,
    requiresPrescription, isVaccine, vaccineDetails, isActive
  } = req.body;

  // Basic validation
  if (!name || price === undefined || stock_quantity === undefined) { // price and stock_quantity can be 0, so check undefined
    return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes (nome, preço de venda, quantidade em estoque).' });
  }

  try {
    const newProductData = {
      tenant_id,
      name,
      description: description || null,
      sku: sku || null,
      barcode: barcode || null,
      category: category || null,
      ncm: ncm || null,
      type: module || 'petshop', // Map 'module' from form to 'type' in model
      stockQuantity: safeParseInt(stock_quantity, 0),
      minStockLevel: safeParseInt(low_stock_threshold, 0), // Map from form
      cost_price: safeParseFloat(cost_price),
      sellingPrice: safeParseFloat(price), // Map 'price' from form to 'sellingPrice'
      image_url: image_url || null,
      allowInternalUse: !!allowInternalUse, // Coerce to boolean
      administrationPrice: safeParseFloat(administrationPrice),
      requiresPrescription: !!requiresPrescription,
      isVaccine: !!isVaccine,
      vaccineDetails: isVaccine ? (vaccineDetails || {}) : undefined,
      isActive: isActive !== undefined ? isActive : true,
    };
    
    // Selling price is required by model, ensure it's not null after parsing
    if (newProductData.sellingPrice === null) {
        return res.status(400).json({ success: false, message: 'Preço de venda inválido ou ausente.'});
    }

    const product = new Product(newProductData);
    const savedProduct = await product.save();

    console.log(`Product created successfully with ID: ${savedProduct._id} for tenant ${tenant_id}`);
    res.status(201).json({ success: true, product: savedProduct });

  } catch (error) {
    return handleProductError(res, error, 'criar produto');
  }
};

// --- GET /api/products --- (List Products)
export const getProducts = async (req, res) => {
  console.log("Received request to list products with query:", req.query);
  const tenant_id = req.user.tenant_id;

  if (!tenant_id && req.user.role !== 'superAdmin') {
    return res.status(403).json({ success: false, message: 'Usuário sem tenant associado ou não autorizado.' });
  }

  try {
    const filters = {};
    if (tenant_id) {
        filters.tenant_id = tenant_id;
    } else if (req.user.role === 'superAdmin' && req.query.tenant_id && mongoose.Types.ObjectId.isValid(req.query.tenant_id)) {
        filters.tenant_id = req.query.tenant_id; // SuperAdmin can filter by tenant
    }

    if (req.query.isActive === 'true' || req.query.isActive === 'false') {
      filters.isActive = req.query.isActive === 'true';
    } else {
      if (req.user.role !== 'superAdmin') {
        filters.isActive = true; // Default to active for non-superAdmins
      }
    }

    if (req.query.name) filters.name = { $regex: req.query.name, $options: 'i' };
    if (req.query.sku) filters.sku = { $regex: req.query.sku, $options: 'i' };
    if (req.query.barcode) filters.barcode = { $regex: req.query.barcode, $options: 'i' };
    if (req.query.category) filters.category = req.query.category;
    if (req.query.type) filters.type = req.query.type; // Use 'type' for filtering
    if (req.query.ncm) filters.ncm = req.query.ncm;
    if (req.query.requiresPrescription) filters.requiresPrescription = req.query.requiresPrescription === 'true';
    if (req.query.isVaccine) filters.isVaccine = req.query.isVaccine === 'true';

    // TODO: Add pagination, sorting from query params
    const products = await Product.find(filters).sort({ name: 1 });
    res.status(200).json({ success: true, count: products.length, products: products });

  } catch (error) {
    return handleProductError(res, error, 'listar produtos');
  }
};

// --- GET /api/products/:id --- (Get Product by ID)
export const getProductById = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id;
  console.log(`Received request to get product by ID: ${id} for tenant: ${tenant_id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de produto inválido.' });
  }

  const query = { _id: id };
  if (req.user.role !== 'superAdmin') {
      if (!tenant_id) return res.status(403).json({ success: false, message: 'Usuário sem tenant associado.' });
      query.tenant_id = tenant_id;
  }

  try {
    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    res.status(200).json({ success: true, product: product });
  } catch (error) {
    return handleProductError(res, error, `buscar produto ${id}`);
  }
};

// --- PUT /api/products/:id --- (Update Product)
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  let updateData = req.body;
  const tenant_id = req.user.tenant_id;
  console.log(`Received request to update product ${id} for tenant ${tenant_id} with data:`, updateData);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de produto inválido.' });
  }
  if (!tenant_id || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Apenas administradores de tenant podem atualizar produtos.' });
  }

  const allowedUpdates = {};
  const formToModelMapping = {
      module: 'type',
      price: 'sellingPrice',
      low_stock_threshold: 'minStockLevel',
      stock_quantity: 'stockQuantity'
  };

  for (const key in updateData) {
      if (key === '_id' || key === 'tenant_id' || key === 'created_at' || key === 'updated_at') continue;
      const modelKey = formToModelMapping[key] || key;
      allowedUpdates[modelKey] = updateData[key];
  }
  
  // Ensure numeric conversions for relevant fields using helper functions
  if (allowedUpdates.sellingPrice !== undefined) allowedUpdates.sellingPrice = safeParseFloat(allowedUpdates.sellingPrice);
  if (allowedUpdates.cost_price !== undefined) allowedUpdates.cost_price = safeParseFloat(allowedUpdates.cost_price);
  if (allowedUpdates.stockQuantity !== undefined) allowedUpdates.stockQuantity = safeParseInt(allowedUpdates.stockQuantity, 0);
  if (allowedUpdates.minStockLevel !== undefined) allowedUpdates.minStockLevel = safeParseInt(allowedUpdates.minStockLevel, 0);
  if (allowedUpdates.administrationPrice !== undefined) allowedUpdates.administrationPrice = safeParseFloat(allowedUpdates.administrationPrice);
  
  // Selling price is required, ensure it's not null after parsing if it was provided for update
  if (updateData.price !== undefined && allowedUpdates.sellingPrice === null) {
      return res.status(400).json({ success: false, message: 'Preço de venda inválido.'});
  }

  // Handle boolean coercions
  if (allowedUpdates.allowInternalUse !== undefined) allowedUpdates.allowInternalUse = !!allowedUpdates.allowInternalUse;
  if (allowedUpdates.requiresPrescription !== undefined) allowedUpdates.requiresPrescription = !!allowedUpdates.requiresPrescription;
  if (allowedUpdates.isVaccine !== undefined) allowedUpdates.isVaccine = !!allowedUpdates.isVaccine;
  if (allowedUpdates.isActive !== undefined) allowedUpdates.isActive = !!allowedUpdates.isActive;

  if (allowedUpdates.isVaccine === false) {
      allowedUpdates.vaccineDetails = undefined; 
  } else if (allowedUpdates.isVaccine === true && allowedUpdates.vaccineDetails === undefined && updateData.vaccineDetails !== undefined) {
      allowedUpdates.vaccineDetails = updateData.vaccineDetails; // If form sent it, use it
  } else if (allowedUpdates.isVaccine === true && !allowedUpdates.vaccineDetails) {
      allowedUpdates.vaccineDetails = {}; 
  }

  try {
    const query = { _id: id, tenant_id: tenant_id };
    const updatedProduct = await Product.findOneAndUpdate(
      query,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado para atualização ou não pertence ao tenant.' });
    }
    console.log(`Product ${id} updated successfully.`);
    res.status(200).json({ success: true, product: updatedProduct });
  } catch (error) {
    return handleProductError(res, error, `atualizar produto ${id}`);
  }
};

// --- DELETE /api/products/:id --- (Inactivate Product - Soft Delete)
export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id;
  console.log(`Received request to inactivate product ${id} for tenant ${tenant_id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de produto inválido.' });
  }
  if (!tenant_id || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Apenas administradores de tenant podem inativar produtos.' });
  }

  try {
    const query = { _id: id, tenant_id: tenant_id, isActive: true };
    const inactiveProduct = await Product.findOneAndUpdate(
      query,
      { isActive: false },
      { new: true }
    );

    if (!inactiveProduct) {
      const existingProduct = await Product.findOne({ _id: id, tenant_id: tenant_id });
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
      } else if (!existingProduct.isActive) {
        return res.status(400).json({ success: false, message: 'Produto já está inativo.' });
      }
      return res.status(404).json({ success: false, message: 'Produto não encontrado ou erro ao inativar (já inativo ou não pertence ao tenant).' });
    }

    console.log(`Product ${id} inactivated successfully.`);
    res.status(200).json({ success: true, message: 'Produto inativado com sucesso.', product: inactiveProduct });
  } catch (error) {
    return handleProductError(res, error, `inativar produto ${id}`);
  }
}; 