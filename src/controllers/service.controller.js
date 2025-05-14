import Service from '../models/service.model.js';
import mongoose from 'mongoose';

// Helper function for consistent error handling (can be expanded)
const handleServiceError = (res, error, context) => {
  console.error(`Error ${context}:`, error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: `Erro de validação ao ${context}.`, errors: error.errors });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: `Conflito de dados ao ${context}. Verifique campos únicos como o nome do serviço.`, error: error.keyValue });
  }
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: 'ID inválido fornecido.' });
  }
  return res.status(500).json({ success: false, message: `Erro interno ao ${context}.`, error: error.message });
};

// --- POST /api/services --- (Create Service)
export const createService = async (req, res) => {
  console.log("Received request to create service:", req.body);
  const { name, type, price, durationMinutes, points, category, description, isActive, requiresAppointment, applicableSpecies, required_specialty } = req.body;
  const tenant_id = req.user.tenant_id; // RENAMED from tenantId

  if (!tenant_id) {
    return res.status(403).json({ success: false, message: 'Apenas usuários de tenant podem criar serviços.' });
  }
  if (!name || !type || price === undefined || durationMinutes === undefined) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes (name, type, price, durationMinutes).' });
  }

  try {
    const newServiceData = {
      tenant_id,
      name,
      type,
      price: parseFloat(price),
      durationMinutes: parseInt(durationMinutes),
      points: points !== undefined ? parseInt(points) : 0,
      category: category || null,
      description: description || null,
      isActive: isActive !== undefined ? isActive : true,
      requiresAppointment: requiresAppointment !== undefined ? requiresAppointment : true,
      applicableSpecies: applicableSpecies || [],
      required_specialty: required_specialty || null
    };

    // Ensure required_specialty is only set if type is clinical
    if (newServiceData.type !== 'clinical') {
        delete newServiceData.required_specialty;
    } else if (!newServiceData.required_specialty) { // if clinical but no specialty, ensure it's null not empty string
        newServiceData.required_specialty = null;
    }

    const newService = new Service(newServiceData);
    const savedService = await newService.save();

    console.log(`Service created successfully with ID: ${savedService._id} for tenant ${tenant_id}`);
    res.status(201).json({ success: true, service: savedService });

  } catch (error) {
    return handleServiceError(res, error, 'criar serviço');
  }
};

// --- GET /api/services --- (List Services)
export const getServices = async (req, res) => {
  console.log("Received request to list services with query:", req.query);
  const tenant_id = req.user.tenant_id; // RENAMED from tenantId

  if (!tenant_id && req.user.role !== 'superAdmin') { // Allow superAdmin to potentially see all if not filtering by tenant
    return res.status(403).json({ success: false, message: 'Usuário sem tenant associado ou não autorizado.' });
  }

  try {
    const filters = {};
    if (tenant_id) { // Filter by tenant if user is not superAdmin or if superAdmin provides tenant_id
        filters.tenant_id = tenant_id;
    }
    // SuperAdmin might query for a specific tenant
    if (req.user.role === 'superAdmin' && req.query.tenant_id && mongoose.Types.ObjectId.isValid(req.query.tenant_id)) {
        filters.tenant_id = req.query.tenant_id;
    }


    if (req.query.isActive === 'true' || req.query.isActive === 'false') {
        filters.isActive = req.query.isActive === 'true';
    } else {
        // Default to listing only active services if not specified
        if (req.user.role !== 'superAdmin') { // Super admin might want to see all by default
             filters.isActive = true;
        }
    }
    if (req.query.type) filters.type = req.query.type; // Frontend sends 'type'
    if (req.query.category) filters.category = req.query.category;
    if (req.query.name) filters.name = { $regex: req.query.name, $options: 'i' };

    // TODO: Add pagination, sorting from query params
    const services = await Service.find(filters).sort({ name: 1 });

    res.status(200).json({ success: true, count: services.length, services: services });

  } catch (error) {
    return handleServiceError(res, error, 'listar serviços');
  }
};

// --- GET /api/services/:id --- (Get Service by ID)
export const getServiceById = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id; // RENAMED from tenantId
  console.log(`Received request to get service by ID: ${id} for tenant: ${tenant_id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de serviço inválido.' });
  }
  
  const query = { _id: id };
  if (req.user.role !== 'superAdmin') {
      if (!tenant_id) return res.status(403).json({ success: false, message: 'Usuário sem tenant associado.' });
      query.tenant_id = tenant_id;
  }
  // If superAdmin and tenant_id is in query for some reason, allow it (but normally ID is enough for superAdmin)

  try {
    const service = await Service.findOne(query);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Serviço não encontrado.' });
    }

    res.status(200).json({ success: true, service: service });

  } catch (error) {
    return handleServiceError(res, error, `buscar serviço ${id}`);
  }
};

// --- PUT /api/services/:id --- (Update Service)
export const updateService = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const tenant_id = req.user.tenant_id; // RENAMED from tenantId
  console.log(`Received request to update service ${id} for tenant ${tenant_id} with data:`, updateData);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de serviço inválido.' });
  }
  if (!tenant_id && req.user.role !== 'superAdmin') {
    return res.status(403).json({ success: false, message: 'Apenas usuários de tenant podem atualizar serviços.' });
  }

  // Prevent changing tenant_id and other protected fields
  delete updateData._id;
  delete updateData.tenant_id; // Ensure tenant_id is not in updateData
  delete updateData.created_at;
  // updated_at will be handled by Mongoose timestamps or pre-save hook if defined in model

  // Convert numeric fields from frontend if necessary
  if (updateData.price !== undefined) updateData.price = parseFloat(updateData.price);
  if (updateData.durationMinutes !== undefined) updateData.durationMinutes = parseInt(updateData.durationMinutes);
  if (updateData.points !== undefined) updateData.points = parseInt(updateData.points);
  
  // Handle required_specialty based on type
  if (updateData.type && updateData.type !== 'clinical') {
      delete updateData.required_specialty; // Remove if not clinical
  } else if (updateData.type === 'clinical' && updateData.required_specialty === undefined) {
      // If type is clinical and specialty is not provided, it might mean no change or clear it.
      // If intent is to clear, frontend should send null or empty string that model handles.
      // For now, if undefined, we don't touch it unless model has a default or specific logic.
  } else if (updateData.type === 'clinical' && !updateData.required_specialty) {
      updateData.required_specialty = null; // Set to null if clinical and empty string passed
  }

  try {
    const query = { _id: id };
    if (req.user.role !== 'superAdmin') {
        query.tenant_id = tenant_id;
    }

    const updatedService = await Service.findOneAndUpdate(
      query, 
      { $set: updateData }, // Use $set to apply partial updates
      { new: true, runValidators: true }
    );

    if (!updatedService) {
      return res.status(404).json({ success: false, message: 'Serviço não encontrado para atualização ou não pertence ao tenant.' });
    }

    res.status(200).json({ success: true, service: updatedService });

  } catch (error) {
    return handleServiceError(res, error, `atualizar serviço ${id}`);
  }
};

// --- DELETE /api/services/:id --- (Inactivate Service - Soft Delete)
export const deleteService = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id; // RENAMED from tenantId
  console.log(`Received request to inactivate service ${id} for tenant ${tenant_id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de serviço inválido.' });
  }
  
  const query = { _id: id, isActive: true }; // Only inactivate if currently active
   if (req.user.role !== 'superAdmin') {
      if (!tenant_id) return res.status(403).json({ success: false, message: 'Apenas usuários de tenant podem inativar serviços.' });
      query.tenant_id = tenant_id;
  }

  try {
    const inactiveService = await Service.findOneAndUpdate(
      query,
      { isActive: false }, 
      { new: true }
    );

    if (!inactiveService) {
      return res.status(404).json({ success: false, message: 'Serviço não encontrado, não pertence ao tenant ou já está inativo.' });
    }

    res.status(200).json({ success: true, message: 'Serviço inativado com sucesso.', service: inactiveService });

  } catch (error) {
    return handleServiceError(res, error, `inativar serviço ${id}`);
  }
}; 