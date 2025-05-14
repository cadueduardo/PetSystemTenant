import Episode from '../models/episode.model.js';
import Pet from '../models/pet.model.js';
import mongoose from 'mongoose';

// Função auxiliar para tratamento de erros
const handleEpisodeError = (res, error, statusCode = 500, message = 'Erro interno no servidor') => {
  console.error('[EpisodeController Error]', error);
  // Em vez de depender de process.env aqui, vamos simplificar a mensagem de erro para o cliente.
  // Detalhes completos do erro já estão no console do servidor.
  return res.status(statusCode).json({ success: false, message: message });
};

/**
 * Cria um novo episódio.
 * Esta função é destinada a ser chamada internamente, por exemplo, quando um agendamento é marcado como 'Chegou'.
 * 
 * @param {Object} episodeData - Dados para criar o episódio.
 * @param {string} episodeData.tenant_id - ID do tenant.
 * @param {string} episodeData.patient_id - ID do pet (patient).
 * @param {string} episodeData.owner_id - ID do tutor (owner).
 * @param {string} episodeData.appointmentId - ID do agendamento associado.
 * @param {string} [episodeData.collaboratorId] - ID do veterinário/colaborador.
 * @param {string} [episodeData.serviceId] - ID do serviço.
 * @param {string} [episodeData.service_name] - Nome do serviço.
 * @param {string} [episodeData.specialty_id] - ID da especialidade.
 * @param {string} [episodeData.created_by] - ID do usuário que iniciou a criação.
 * @returns {Promise<Episode>} O episódio criado.
 * @throws {Error} Se houver falha na criação.
 */
export const createEpisodeInternal = async (episodeData) => {
  try {
    const { tenant_id, patient_id, owner_id, appointmentId, collaboratorId, serviceId, service_name, specialty_id, created_by } = episodeData;

    if (!tenant_id || !patient_id || !owner_id || !appointmentId) {
      throw new Error('Dados insuficientes para criar episódio: tenant_id, patient_id, owner_id e appointmentId são obrigatórios.');
    }

    // 1. Gerenciar ProntuarioID para o Pet
    const pet = await Pet.findById(patient_id);
    if (!pet) {
      throw new Error('Pet não encontrado para criar o episódio.');
    }

    let prontuarioIdToUse = pet.prontuarioId;
    if (!prontuarioIdToUse) {
      // Gera um prontuário ID simples. Idealmente, seria um sequencial por tenant.
      prontuarioIdToUse = `PT-${tenant_id.toString().slice(-4)}${Date.now().toString().slice(-6)}`;
      pet.prontuarioId = prontuarioIdToUse;
      // Adicionar ao histórico de alterações do pet, se houver
      // pet.history.push({ event: 'Prontuário Criado', new_value: prontuarioIdToUse, changed_by: created_by || new mongoose.Types.ObjectId() }); 
      await pet.save(); 
      console.log(`[EpisodeController] Prontuario ID ${prontuarioIdToUse} gerado e salvo para o Pet ${pet._id}`);
    }

    // 2. Gerar EpisodeNumber (ex: EP- seguido de timestamp em base36 para encurtar)
    // Ou um sequencial por tenant.
    const generatedEpisodeNumber = `EP-${Date.now().toString(36)}`;

    // 3. Montar dados do novo episódio
    const newEpisodePayload = {
      tenant_id,
      patient_id,
      owner_id,
      appointmentId,
      prontuarioId: prontuarioIdToUse,
      episodeNumber: generatedEpisodeNumber,
      collaboratorId: collaboratorId || null,
      serviceId: serviceId || null,
      service_name: service_name || null,
      specialty_id: specialty_id || null,
      status: 'Aguardando Atendimento', // Status inicial
      startTime: new Date(), // Marca o início do episódio com a data/hora atual
      created_by: created_by || null, // Usuário que efetivamente causou a criação
      // Outros campos como clinicalSigns, anamnesis, etc., serão preenchidos depois
      prescription: { internalMedication: [], externalPrescription: [], recommendations: '' },
      exams: []
    };

    const episode = new Episode(newEpisodePayload);
    await episode.save();

    console.log(`[EpisodeController] Episódio ${episode.episodeNumber} criado com sucesso para o appointment ${appointmentId}`);
    return episode;

  } catch (error) {
    console.error('[createEpisodeInternal Error]', error);
    // Re-throw o erro para que o chamador (ex: appointmentController) possa tratá-lo
    // ou logá-lo apropriadamente no contexto da requisição original.
    throw error; 
  }
};

// Exemplo de como seria a função de controller para uma rota POST (se necessária no futuro)
// Por ora, o foco é na createEpisodeInternal
export const createEpisodeHandler = async (req, res) => {
  try {
    // Supondo que o ID do usuário logado e o tenant_id vêm do req (ex: req.user.id, req.tenant.id)
    const created_by = req.user?.id; 
    const tenant_id_from_req = req.tenant?.id; 

    const { 
      patient_id, 
      owner_id, 
      appointmentId, 
      collaboratorId, 
      serviceId, 
      service_name, 
      specialty_id 
      // Não esperamos prontuarioId ou episodeNumber do request, serão gerados
    } = req.body;

    if (!tenant_id_from_req) {
      return handleEpisodeError(res, new Error('Tenant ID não encontrado na requisição.'), 400, 'Tenant ID não fornecido.');
    }
    if (!created_by) {
      return handleEpisodeError(res, new Error('Usuário não autenticado.'), 401, 'Usuário não autenticado.');
    }

    const episodeData = {
      tenant_id: tenant_id_from_req,
      patient_id,
      owner_id,
      appointmentId,
      collaboratorId,
      serviceId,
      service_name,
      specialty_id,
      created_by
    };

    const episode = await createEpisodeInternal(episodeData);
    return res.status(201).json({ success: true, message: 'Episódio criado com sucesso.', data: episode });

  } catch (error) {
    // Verifica se o erro já tem um statusCode (ex: erro de validação do Mongoose)
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Falha ao criar episódio.';
    return handleEpisodeError(res, error, statusCode, message);
  }
};

// --- GET /api/episodes --- (List Episodes)
export const getEpisodes = async (req, res) => {
  console.log("[getEpisodes] Received request with query:", req.query);
  const tenant_id = req.user?.tenant_id;

  if (!tenant_id && req.user?.role !== 'superAdmin') {
      return handleEpisodeError(res, new Error('Acesso não autorizado.'), 403, 'Usuário sem tenant associado ou não é SuperAdmin.');
  }

  try {
    const filters = {};
    if (tenant_id) {
        filters.tenant_id = tenant_id;
    }

    const { patient_id, owner_id, collaboratorId, serviceId, appointmentId, status, episodeNumber, startDate, endDate } = req.query;

    if (patient_id) {
        if (!mongoose.Types.ObjectId.isValid(patient_id)) return handleEpisodeError(res, new Error('ID do Pet (patient_id) inválido.'), 400, 'ID do Pet (patient_id) inválido.');
        filters.patient_id = patient_id;
    }
    if (owner_id) {
         if (!mongoose.Types.ObjectId.isValid(owner_id)) return handleEpisodeError(res, new Error('ID do Tutor (owner_id) inválido.'), 400, 'ID do Tutor (owner_id) inválido.');
        filters.owner_id = owner_id;
    }
    if (collaboratorId) {
         if (!mongoose.Types.ObjectId.isValid(collaboratorId)) return handleEpisodeError(res, new Error('ID do Colaborador (collaboratorId) inválido.'), 400, 'ID do Colaborador (collaboratorId) inválido.');
        filters.collaboratorId = collaboratorId;
    }
    if (serviceId) {
        if (!mongoose.Types.ObjectId.isValid(serviceId)) return handleEpisodeError(res, new Error('ID do Serviço (serviceId) inválido.'), 400, 'ID do Serviço (serviceId) inválido.');
       filters.serviceId = serviceId;
    }
    if (appointmentId) {
        if (!mongoose.Types.ObjectId.isValid(appointmentId)) return handleEpisodeError(res, new Error('ID do Agendamento (appointmentId) inválido.'), 400, 'ID do Agendamento (appointmentId) inválido.');
        filters.appointmentId = appointmentId;
    }
    if (status) {
        filters.status = status;
    }
    if (episodeNumber) {
        filters.episodeNumber = { $regex: episodeNumber, $options: 'i' }; // Case-insensitive search
    }
    if (startDate || endDate) {
      filters.startTime = {}; // Filtrando pelo início do episódio
      if (startDate) {
        try { filters.startTime.$gte = new Date(startDate); } 
        catch (e) { return handleEpisodeError(res, e, 400, 'Formato de startDate inválido.'); }
      }
      if (endDate) {
        try { 
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            filters.startTime.$lte = endOfDay; 
        } 
        catch (e) { return handleEpisodeError(res, e, 400, 'Formato de endDate inválido.'); }
      }
    }

    console.log("[getEpisodes] Filtering with:", filters);
    const episodes = await Episode.find(filters)
      .populate('patient_id', 'name species prontuarioId')
      .populate('owner_id', 'full_name email')
      .populate('collaboratorId', 'displayName')
      .populate('serviceId', 'name')
      .populate('appointmentId', 'appointment_date status')
      .sort({ startTime: -1 });

    return res.status(200).json({ success: true, count: episodes.length, data: episodes });

  } catch (error) {
    return handleEpisodeError(res, error, 500, 'Erro ao listar episódios.');
  }
};

// --- GET /api/episodes/:id --- (Get Episode by ID)
export const getEpisodeById = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user?.tenant_id;
  console.log(`[getEpisodeById] Received request for ID: ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return handleEpisodeError(res, new Error('ID de episódio inválido.'), 400, 'ID de episódio inválido.');
  }
  if (!tenant_id && req.user?.role !== 'superAdmin') {
    return handleEpisodeError(res, new Error('Acesso não autorizado.'), 403, 'Usuário sem tenant associado ou não é SuperAdmin.');
  }

  try {
    const query = { _id: id };
    if (tenant_id) {
      query.tenant_id = tenant_id;
    }

    const episode = await Episode.findOne(query)
        .populate('patient_id')
        .populate('owner_id', 'full_name email phone')
        .populate('collaboratorId', 'displayName')
        .populate('serviceId', 'name type')
        .populate('appointmentId')
        .populate('created_by', 'displayName');

    if (!episode) {
      return handleEpisodeError(res, new Error('Episódio não encontrado.'), 404, 'Episódio não encontrado.');
    }

    // Adicional: Se o usuário logado é um 'tutor', verificar se ele é o dono do pet do episódio
    if (req.user?.role === 'tutor' && episode.owner_id?._id.toString() !== req.user._id.toString()) {
        return handleEpisodeError(res, new Error('Acesso negado ao episódio.'), 403, 'Você só pode visualizar episódios dos seus pets.');
    }

    return res.status(200).json({ success: true, data: episode });

  } catch (error) {
    return handleEpisodeError(res, error, 500, 'Erro ao buscar episódio.');
  }
};

// --- PUT /api/episodes/:id --- (Update Episode)
export const updateEpisode = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const tenant_id = req.user?.tenant_id;
  const updater_user_id = req.user?._id;
  console.log(`[updateEpisode] Received request for ID ${id} with data:`, updateData);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return handleEpisodeError(res, new Error('ID de episódio inválido.'), 400, 'ID de episódio inválido.');
  }
  if (!tenant_id && req.user?.role !== 'superAdmin') {
    return handleEpisodeError(res, new Error('Acesso não autorizado.'), 403, 'Usuário sem tenant associado ou não é SuperAdmin.');
  }

  // Remover campos protegidos que não devem ser atualizados via este endpoint
  delete updateData._id;
  delete updateData.tenant_id;
  delete updateData.patient_id; 
  delete updateData.owner_id;   
  delete updateData.episodeNumber;
  delete updateData.prontuarioId;
  // delete updateData.startTime; // Permitir update de startTime?
  delete updateData.created_at;
  delete updateData.created_by;
  // updated_at será tratado pelo hook do Mongoose ou explicitamente

  updateData.updated_by = updater_user_id; // Registrar quem atualizou

  try {
    const query = { _id: id };
    if (tenant_id) {
      query.tenant_id = tenant_id;
    }

    const episode = await Episode.findOne(query);
    if (!episode) {
        return handleEpisodeError(res, new Error('Episódio não encontrado para atualização.'), 404, 'Episódio não encontrado.');
    }

    // Lógica específica para transição de status, ex: Concluir episódio
    if (updateData.status === 'Concluído' && episode.status !== 'Concluído') {
        updateData.endTime = updateData.endTime || new Date(); // Marcar hora de conclusão se não especificada
    }
    // Adicionar outras lógicas de transição de status se necessário

    const updatedEpisode = await Episode.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    if (!updatedEpisode) { // Fallback, mas findOne já deveria ter pego
        return handleEpisodeError(res, new Error('Falha ao atualizar episódio após busca.'), 404, 'Episódio não encontrado para atualização.');
    }

    return res.status(200).json({ success: true, message: 'Episódio atualizado com sucesso.', data: updatedEpisode });

  } catch (error) {
    if (error.name === 'ValidationError') {
        return handleEpisodeError(res, error, 400, 'Erro de validação ao atualizar episódio.');
    }
    return handleEpisodeError(res, error, 500, 'Erro ao atualizar episódio.');
  }
};

// --- DELETE /api/episodes/:id --- (Cancel Episode - Soft Delete)
export const deleteEpisode = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user?.tenant_id;
  const canceller_user_id = req.user?._id;
  console.log(`[deleteEpisode] Received request to cancel episode ID: ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return handleEpisodeError(res, new Error('ID de episódio inválido.'), 400, 'ID de episódio inválido.');
  }
  if (!tenant_id && req.user?.role !== 'superAdmin') {
    return handleEpisodeError(res, new Error('Acesso não autorizado.'), 403, 'Usuário sem tenant associado ou não é SuperAdmin.');
  }

  try {
    const query = { _id: id, status: { $ne: 'Cancelado' } }; // Só cancela se não estiver já cancelado
    if (tenant_id) {
      query.tenant_id = tenant_id;
    }

    const update = { 
        status: 'Cancelado', 
        endTime: new Date(), // Marcar hora de conclusão/cancelamento
        updated_by: canceller_user_id
    }; 

    const cancelledEpisode = await Episode.findOneAndUpdate(query, update, { new: true });

    if (!cancelledEpisode) {
       return handleEpisodeError(res, new Error('Episódio não encontrado ou já está cancelado.'), 404, 'Episódio não encontrado ou já cancelado.');
    }

    return res.status(200).json({ success: true, message: 'Episódio cancelado com sucesso.', data: cancelledEpisode });

  } catch (error) {
    return handleEpisodeError(res, error, 500, 'Erro ao cancelar episódio.');
  }
};

// TODO: Adicionar outras funções CRUD (get, update, delete, list) e exportá-las.
// export { createEpisodeInternal, createEpisodeHandler /*, outras Funcoes */ }; 