import Pet from '../models/pet.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';

// Helper function (example) - might move to utils
const handleErrors = (res, error, context) => {
  console.error(`Error ${context}:`, error);
  if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: `Erro de validação ao ${context}.`, errors: error.errors });
  } 
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'ID inválido fornecido.' });
  }
  // Add more specific error handling as needed (e.g., duplicate key errors)
  return res.status(500).json({ success: false, message: `Erro interno ao ${context}.`, error: error.message });
};


// --- POST /api/pets --- (Create Pet)
export const createPet = async (req, res) => {
  console.log("Received request to create pet:", req.body);
  const { 
    name, species, breed, gender, birth_date, photo_url, 
    allergies, observations, owner_id, prontuarioId,
    is_inactive, date_of_death, inactivation_reason, health_plan_id 
  } = req.body;
  const requestingUser = req.user; // Added by authenticateToken

  // Basic validation
  if (!name || !species || !owner_id) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes (name, species, owner_id).' });
  }

  // Authorization: Ensure user is admin/collaborator of the tenant the tutor belongs to
  if (!requestingUser.tenant_id) {
       return res.status(403).json({ success: false, message: 'Apenas usuários de tenant podem criar pets.' });
  }

  try {
    // Verify tutor exists and belongs to the same tenant as the requesting user
    const tutorCheck = await User.findById(owner_id);
    if (!tutorCheck || tutorCheck.role !== 'tutor' || tutorCheck.tenant_id?.toString() !== requestingUser.tenant_id.toString()) {
        console.warn(`Attempt to create pet for invalid tutor ${owner_id} or tutor from different tenant.`);
        return res.status(400).json({ success: false, message: 'Tutor inválido ou não pertence ao tenant correto.' });
    }

    const newPetData = {
        tenant_id: requestingUser.tenant_id,
        owner_id,
        name,
        species,
        breed,
        gender,
        birth_date,
        photo_url,
        allergies,
        observations,
        prontuarioId,
    };

    // Adiciona campos opcionais se fornecidos
    if (is_inactive !== undefined) newPetData.is_inactive = is_inactive;
    if (date_of_death !== undefined) newPetData.date_of_death = date_of_death;
    if (inactivation_reason !== undefined) newPetData.inactivation_reason = inactivation_reason;
    if (health_plan_id !== undefined) newPetData.health_plan_id = health_plan_id;
    
    const newPet = new Pet(newPetData);

    const savedPet = await newPet.save();
    console.log(`Pet created successfully with ID: ${savedPet._id} for tenant ${requestingUser.tenant_id}`);

    return res.status(201).json({ success: true, pet: savedPet });

  } catch (error) {
    return handleErrors(res, error, 'criar pet');
  }
};

// --- GET /api/pets --- (Get Pets with Filters)
export const getPets = async (req, res) => {
  console.log("Received request to list pets with query:", req.query);
  const requestingUser = req.user;
  const { owner_id, status, name, species, prontuarioId, is_inactive: query_is_inactive } = req.query;

  try {
    const filters = {};

    // Authorization: Filter by tenant MANDATORY
    if (!requestingUser.tenant_id && requestingUser.role !== 'superAdmin') {
         return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    // If user is admin/collaborator, filter by their tenant
    if (requestingUser.tenant_id) {
        filters.tenant_id = requestingUser.tenant_id;
    }
    // If user is tutor, further filter by their own ID
    if (requestingUser.role === 'tutor') {
        filters.owner_id = requestingUser._id;
    }

    // Apply optional filters from query params
    if (owner_id && mongoose.Types.ObjectId.isValid(owner_id)) {
      // Allow admin/collaborator to filter by specific tutor within their tenant
      if (requestingUser.role === 'admin' || requestingUser.role === 'collaborator'){
          filters.owner_id = owner_id;
      } else if (requestingUser.role === 'tutor' && requestingUser._id.toString() !== owner_id) {
           // Tutor trying to query another tutor's pets - block
            console.warn(`Tutor ${requestingUser._id} attempted to query pets for tutor ${owner_id}`);
            return res.status(403).json({ success: false, message: 'Você só pode visualizar seus próprios pets.' });
      }
    }
    
    // Handle status filter (is_inactive)
    if (query_is_inactive !== undefined) {
        filters.is_inactive = query_is_inactive === 'true';
    } else if (status) {
      if (status === 'active') {
        filters.is_inactive = false;
      } else if (['inactive', 'deceased'].includes(status)) {
        filters.is_inactive = true;
      }
    }

    if (name) {
        filters.name = { $regex: name, $options: 'i' }; // Case-insensitive search
    }
     if (species) {
        filters.species = { $regex: species, $options: 'i' };
    }
    if (prontuarioId) {
        filters.prontuarioId = prontuarioId;
    }
    // TODO: Add pagination

    console.log("Fetching pets with filters:", filters);
    const pets = await Pet.find(filters)
      // .populate('owner_id', 'displayName email')
      .sort({ name: 1 }); // Sort by name

    console.log(`Found ${pets.length} pets matching filters.`);
    return res.status(200).json({ success: true, count: pets.length, pets: pets });

  } catch (error) {
    return handleErrors(res, error, 'listar pets');
  }
};

// --- GET /api/pets/:id --- (Get Pet by ID)
export const getPetById = async (req, res) => {
  const { id } = req.params;
  const requestingUser = req.user;
  console.log(`Received request to get pet by ID: ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de Pet inválido.' });
  }

  try {
    const pet = await Pet.findById(id);
      // .populate('owner_id', 'displayName email phone');

    if (!pet) {
      console.warn(`Pet not found with ID: ${id}`);
      return res.status(404).json({ success: false, message: 'Pet não encontrado.' });
    }

    // Authorization Check
    const isSuperAdmin = requestingUser.role === 'superAdmin';
    const isOwnerTenantMember = requestingUser.tenant_id && pet.tenant_id.toString() === requestingUser.tenant_id.toString();
    const isTutorOwner = requestingUser.role === 'tutor' && pet.owner_id.toString() === requestingUser._id.toString();

    if (!isSuperAdmin && !isOwnerTenantMember) {
        console.warn(`User ${requestingUser._id} from tenant ${requestingUser.tenant_id} tried to access pet ${id} from tenant ${pet.tenant_id}`);
        return res.status(403).json({ success: false, message: 'Acesso negado a este pet.' });
    }
    // If user is a tutor, they must be the owner tutor
     if (requestingUser.role === 'tutor' && !isTutorOwner) {
        console.warn(`Tutor ${requestingUser._id} tried to access pet ${id} owned by tutor ${pet.owner_id}`);
        return res.status(403).json({ success: false, message: 'Você só pode visualizar seus próprios pets.' });
    }

    console.log(`Pet ${id} found and authorized.`);
    return res.status(200).json({ success: true, pet: pet });

  } catch (error) {
    return handleErrors(res, error, `buscar pet ${id}`);
  }
};

// --- PUT /api/pets/:id --- (Update Pet by ID)
export const updatePet = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const requestingUser = req.user;
  console.log(`Received request to update pet ${id} with data:`, updateData);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de Pet inválido.' });
  }

  // Remove fields that should not be updated directly or need specific logic
  delete updateData._id;
  delete updateData.tenant_id;
  delete updateData.owner_id;
  delete updateData.prontuarioId;
  delete updateData.created_at;
  delete updateData.updated_at;

  try {
    const pet = await Pet.findById(id);

    if (!pet) {
      console.warn(`Pet not found with ID: ${id} during update attempt.`);
      return res.status(404).json({ success: false, message: 'Pet não encontrado para atualização.' });
    }

    // Authorization: Only admin/collaborator of the same tenant can update
    if (!requestingUser.tenant_id || pet.tenant_id.toString() !== requestingUser.tenant_id.toString()) {
        console.warn(`User ${requestingUser._id} (tenant: ${requestingUser.tenant_id}) attempt to update pet ${id} (tenant: ${pet.tenant_id})`);
        return res.status(403).json({ success: false, message: 'Você não tem permissão para atualizar este pet.' });
    }
     if (!['admin', 'collaborator', 'superAdmin'].includes(requestingUser.role)) {
        console.warn(`User ${requestingUser._id} with role ${requestingUser.role} attempt to update pet ${id}`);
        return res.status(403).json({ success: false, message: 'Permissão negada para atualizar pets.' });
    }

    // Apply updates - Mongoose will only update fields present in updateData
    Object.assign(pet, updateData);
    const updatedPet = await pet.save();

    console.log(`Pet ${id} updated successfully.`);
    return res.status(200).json({ success: true, pet: updatedPet });

  } catch (error) {
    return handleErrors(res, error, `atualizar pet ${id}`);
  }
};

// --- DELETE /api/pets/:id --- (Soft Delete Pet by ID - now inactivatePet)
export const inactivatePet = async (req, res) => {
  const { id } = req.params;
  const requestingUser = req.user;
  const { inactivation_reason, date_of_death } = req.body; 
  console.log(`Received request to inactivate pet ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de Pet inválido.' });
  }

  try {
    const pet = await Pet.findById(id);

    if (!pet) {
      console.warn(`Pet not found with ID: ${id} during inactivation attempt.`);
      return res.status(404).json({ success: false, message: 'Pet não encontrado para inativar.' });
    }

    // Authorization: Only admin/collaborator of the same tenant can inactivate
    if (!requestingUser.tenant_id || pet.tenant_id.toString() !== requestingUser.tenant_id.toString()) {
        console.warn(`User ${requestingUser._id} (tenant: ${requestingUser.tenant_id}) attempt to inactivate pet ${id} (tenant: ${pet.tenant_id})`);
        return res.status(403).json({ success: false, message: 'Você não tem permissão para inativar este pet.' });
    }
     if (!['admin', 'collaborator', 'superAdmin'].includes(requestingUser.role)) {
        console.warn(`User ${requestingUser._id} with role ${requestingUser.role} attempt to inactivate pet ${id}`);
        return res.status(403).json({ success: false, message: 'Permissão negada para inativar pets.' });
    }

    // Perform soft delete by setting is_inactive to true
    pet.is_inactive = true;
    if (inactivation_reason) {
        pet.inactivation_reason = inactivation_reason;
    }
    if (date_of_death) {
        pet.date_of_death = date_of_death;
    }
    const inactivatedPet = await pet.save();

    console.log(`Pet ${id} inactivated successfully.`);
    return res.status(200).json({ success: true, message: 'Pet inativado com sucesso.', pet: inactivatedPet });

  } catch (error) {
    return handleErrors(res, error, `inativar pet ${id}`);
  }
}; 