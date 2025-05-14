import Appointment from '../models/appointment.model.js';
import Pet from '../models/pet.model.js'; // Needed for validation
import User from '../models/user.model.js'; // Needed for validation
import Service from '../models/service.model.js'; // Needed for validation
import mongoose from 'mongoose';
import { createEpisodeInternal } from './episode.controller.js'; // Importar a função de criação de episódio

// Helper function for consistent error handling
const handleAppointmentError = (res, error, context) => {
  console.error(`Error ${context}:`, error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: `Erro de validação ao ${context}.`, errors: error.errors });
  }
  if (error.code === 11000) { // Embora não haja campos unique óbvios no Appointment além do _id
    return res.status(409).json({ success: false, message: `Conflito de dados ao ${context}.`, error: error.keyValue });
  }
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: 'ID inválido fornecido.' });
  }
  // Custom business logic errors
  if (error.isBusinessLogicError) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: `Erro interno ao ${context}.`, error: error.message });
};

// --- POST /api/appointments --- (Create Appointment)
export const createAppointment = async (req, res) => {
  console.log("Received request to create appointment:", req.body);
  const tenant_id = req.user.tenant_id;
  const created_by_user_id = req.user._id;

  const {
    patient_id,
    owner_id,
    associated_vet_id,
    serviceId,
    service_name,
    appointment_date,
    duration,
    end_time,
    price,
    status,
    confirmationStatus,
    check_in_timestamp,
    checkout_timestamp,
    additional_info,
    cancellationReason,
    specialty_id,
    requester_type,
    referring_clinic_name,
    price_table_id,
    transport_required,
    secondary_procedures_notes,
    created_by_type // Normalmente 'user' ao criar via API por um usuário logado
  } = req.body;

  // 1. Basic Input Validation
  if (!patient_id || !owner_id || !appointment_date) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes: patient_id, owner_id, appointment_date.' });
  }
  if (!mongoose.Types.ObjectId.isValid(patient_id)) {
    return res.status(400).json({ success: false, message: 'patient_id inválido.' });
  }
  if (!mongoose.Types.ObjectId.isValid(owner_id)) {
    return res.status(400).json({ success: false, message: 'owner_id inválido.' });
  }
  if (associated_vet_id && !mongoose.Types.ObjectId.isValid(associated_vet_id)) {
    return res.status(400).json({ success: false, message: 'associated_vet_id inválido.' });
  }
  if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
    return res.status(400).json({ success: false, message: 'serviceId inválido.' });
  }
  if (isNaN(new Date(appointment_date).getTime())) {
      return res.status(400).json({ success: false, message: 'Formato de appointment_date inválido.' });
  }
  if (end_time && isNaN(new Date(end_time).getTime())){
      return res.status(400).json({ success: false, message: 'Formato de end_time inválido.' });
  }
  if (duration && (typeof duration !== 'number' || duration <= 0)){
      return res.status(400).json({ success: false, message: 'Duração (duration) inválida. Deve ser um número positivo de minutos.' });
  }

  try {
    // 2. Advanced Validation (existence and ownership)
    const pet = await Pet.findOne({ _id: patient_id, tenant_id });
    if (!pet) {
      return res.status(404).json({ success: false, message: `Pet com ID ${patient_id} não encontrado ou não pertence a este tenant.` });
    }
    if (pet.owner_id.toString() !== owner_id) {
        return res.status(400).json({ success: false, message: `O tutor (owner_id ${owner_id}) não corresponde ao tutor do pet (pet.owner_id ${pet.owner_id}).` });
    }
    const owner = await User.findOne({ _id: owner_id, tenant_id, role: 'tutor' });
    if (!owner) {
      return res.status(404).json({ success: false, message: `Tutor com ID ${owner_id} não encontrado ou não pertence a este tenant.` });
    }
    if (associated_vet_id) {
      const vet = await User.findOne({ _id: associated_vet_id, tenant_id });
      if (!vet || (vet.role !== 'admin' && vet.role !== 'collaborator')) {
        return res.status(404).json({ success: false, message: `Veterinário associado com ID ${associated_vet_id} não encontrado, não pertence a este tenant ou não tem role apropriada.` });
      }
    }
    
    let actualServiceName = service_name;
    let actualDuration = duration;
    let actualPrice = price;
    let actualSpecialtyId = specialty_id;
    let calculatedEndTime = end_time ? new Date(end_time) : null;

    if (serviceId) {
        const service = await Service.findOne({ _id: serviceId, tenant_id });
        if (service) {
            actualServiceName = service.name; // Prioriza nome do serviço do DB
            if (actualDuration === undefined || actualDuration === null) { 
                actualDuration = service.durationMinutes;
            }
            if (actualPrice === undefined || actualPrice === null) { // Se preço não veio no body, usa do serviço
                actualPrice = service.price;
            }
            if (!actualSpecialtyId && service.required_specialty && service.required_specialty !== '__NONE__') {
                actualSpecialtyId = service.required_specialty;
            }
        } else {
            // Se serviceId foi fornecido mas serviço não encontrado, pode ser um erro ou um ID legado.
            // Por ora, se não encontrar, mantém o service_name e outros dados do request, mas loga um aviso.
            console.warn(`Serviço com ID ${serviceId} não encontrado no tenant ${tenant_id}. Usando service_name do request: ${service_name}`);
            // Não retorna erro aqui, permite agendamento com serviceId inválido mas com nome, se for o caso de uso.
            // Se serviceId é mandatório e deve existir, a validação seria mais estrita:
            // return res.status(404).json({ success: false, message: `Serviço com ID ${serviceId} não encontrado ou não pertence a este tenant.` });
        }
    }

    // Calcula end_time se não foi fornecido e temos data de início e duração
    if (!calculatedEndTime && appointment_date && actualDuration) {
        const startDate = new Date(appointment_date);
        calculatedEndTime = new Date(startDate.getTime() + actualDuration * 60000); // duration em minutos
    }

    const newAppointmentData = {
      tenant_id,
      patient_id,
      owner_id,
      associated_vet_id: associated_vet_id || null,
      serviceId: serviceId || null,
      service_name: actualServiceName,
      appointment_date: new Date(appointment_date),
      duration: actualDuration,
      end_time: calculatedEndTime,
      price: actualPrice !== undefined ? actualPrice : 0, // Garante que seja um número
      status: status || 'Agendado',
      confirmationStatus: confirmationStatus || { sent: false, response: null, sentAt: null, responseAt: null }, 
      check_in_timestamp: check_in_timestamp ? new Date(check_in_timestamp) : null,
      checkout_timestamp: checkout_timestamp ? new Date(checkout_timestamp) : null,
      additional_info: additional_info || null,
      cancellationReason: cancellationReason || null,
      specialty_id: actualSpecialtyId || null,
      requester_type: requester_type || 'Proprietário',
      referring_clinic_name: referring_clinic_name || null,
      price_table_id: price_table_id || null,
      transport_required: transport_required !== undefined ? transport_required : false,
      secondary_procedures_notes: secondary_procedures_notes || null,
      created_by: created_by_user_id,
      created_by_type: created_by_type || 'user'
    };

    const newAppointment = new Appointment(newAppointmentData);
    const savedAppointment = await newAppointment.save();

    console.log(`Appointment created successfully with ID: ${savedAppointment._id}`);
    res.status(201).json({ success: true, appointment: savedAppointment });

  } catch (error) {
    return handleAppointmentError(res, error, 'criar agendamento');
  }
};

// --- GET /api/appointments --- (List Appointments)
export const getAppointments = async (req, res) => {
  console.log("Received request to list appointments with query:", req.query);
  const tenant_id = req.user.tenant_id;
  if (!tenant_id && req.user.role !== 'superAdmin') {
      return res.status(403).json({ success: false, message: 'Usuário sem tenant associado ou não autorizado.'});
  }

  try {
    const filters = {};
    if (tenant_id) {
      filters.tenant_id = tenant_id;
    }

    const { status, patient_id, owner_id, associated_vet_id, start_date, end_date, serviceId, specialty_id } = req.query;
    if (status) filters.status = status;
    if (patient_id && mongoose.Types.ObjectId.isValid(patient_id)) filters.patient_id = patient_id;
    if (owner_id && mongoose.Types.ObjectId.isValid(owner_id)) filters.owner_id = owner_id;
    if (associated_vet_id && mongoose.Types.ObjectId.isValid(associated_vet_id)) filters.associated_vet_id = associated_vet_id;
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) filters.serviceId = serviceId;
    if (specialty_id) filters.specialty_id = specialty_id; // Assume string
    
    if (start_date || end_date) {
      filters.appointment_date = {};
      if (start_date) filters.appointment_date.$gte = new Date(start_date);
      if (end_date) {
        const endDateObj = new Date(end_date);
        // Para incluir todo o dia de end_date, ajustamos para o fim do dia
        filters.appointment_date.$lte = new Date(endDateObj.setHours(23, 59, 59, 999));
      }
    }

    console.log("Filtering appointments with:", filters);

    const appointments = await Appointment.find(filters)
      .populate('patient_id', 'name species breed photo_url') // Adicionado photo_url
      .populate('owner_id', 'displayName email full_name phone') // Adicionado phone
      .populate('associated_vet_id', 'displayName')
      .populate('serviceId', 'name type price durationMinutes required_specialty') // Populando serviço
      .sort({ appointment_date: 1 });

    res.status(200).json({ success: true, count: appointments.length, appointments: appointments });

  } catch (error) {
    return handleAppointmentError(res, error, 'listar agendamentos');
  }
};

// --- GET /api/appointments/:id --- (Get Appointment by ID)
export const getAppointmentById = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id;
  console.log(`Received request to get appointment by ID: ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de agendamento inválido.' });
  }
  if (!tenant_id && req.user.role !== 'superAdmin') {
      return res.status(403).json({ success: false, message: 'Usuário sem tenant associado ou não autorizado.'});
  }

  try {
    const query = { _id: id };
    if (tenant_id) {
      query.tenant_id = tenant_id;
    }

    const appointment = await Appointment.findOne(query)
        .populate('patient_id')
        .populate('owner_id', 'displayName email phone full_name')
        .populate('associated_vet_id', 'displayName')
        .populate('serviceId'); // Populando serviço

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    }

    res.status(200).json({ success: true, appointment: appointment });

  } catch (error) {
    return handleAppointmentError(res, error, `buscar agendamento ${id}`);
  }
};

// --- PUT /api/appointments/:id --- (Update Appointment)
export const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const tenant_id = req.user.tenant_id;
  const updater_user_id = req.user._id; // Usuário que está fazendo a atualização

  console.log(`Received request to update appointment ${id} with data:`, updateData);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de agendamento inválido.' });
  }
  if (!tenant_id && req.user.role !== 'superAdmin') {
    return res.status(403).json({ success: false, message: 'Usuário sem tenant associado ou não autorizado.' });
  }

  // Campos que não devem ser atualizados diretamente ou que são gerenciados de outra forma
  delete updateData._id;
  delete updateData.tenant_id; // Não pode mudar o tenant de um agendamento
  delete updateData.created_by; 
  delete updateData.created_by_type;
  // updated_at será tratado pelo Mongoose/hook

  // Se serviceId está sendo atualizado, precisamos revalidar e potencialmente buscar novos dados do serviço
  let serviceDetailsForUpdate = null;
  if (updateData.serviceId) {
    if (!mongoose.Types.ObjectId.isValid(updateData.serviceId)){
        return handleAppointmentError(res, { name: 'CastError', kind:'ObjectId' }, 'atualizar agendamento (serviceId inválido)');
    }
    serviceDetailsForUpdate = await Service.findOne({ _id: updateData.serviceId, tenant_id });
    if (!serviceDetailsForUpdate) {
        return res.status(404).json({ success: false, message: `Serviço com ID ${updateData.serviceId} não encontrado neste tenant.` });
    }
    // Atualiza campos dependentes do serviço se o serviceId mudou
    updateData.service_name = serviceDetailsForUpdate.name;
    if (updateData.duration === undefined && serviceDetailsForUpdate.durationMinutes) {
        updateData.duration = serviceDetailsForUpdate.durationMinutes;
    }
    if (updateData.price === undefined && serviceDetailsForUpdate.price !== undefined) {
        updateData.price = serviceDetailsForUpdate.price;
    }
    if (updateData.specialty_id === undefined && serviceDetailsForUpdate.required_specialty && serviceDetailsForUpdate.required_specialty !== '__NONE__') {
        updateData.specialty_id = serviceDetailsForUpdate.required_specialty;
    }
  } 
  // Recalcular end_time se duration ou appointment_date mudou e end_time não foi explicitamente fornecido
  if ( (updateData.duration || updateData.appointment_date) && !updateData.end_time ) {
    const currentAppointmentState = await Appointment.findById(id).lean(); // Pega o estado atual para ter appointment_date ou duration se não vier no update
    const newStartDate = updateData.appointment_date ? new Date(updateData.appointment_date) : new Date(currentAppointmentState.appointment_date);
    const newDuration = updateData.duration !== undefined ? updateData.duration : currentAppointmentState.duration;
    if (newStartDate && newDuration) {
        updateData.end_time = new Date(newStartDate.getTime() + newDuration * 60000);
    }
  }

  try {
    const query = { _id: id };
    if (tenant_id) {
      query.tenant_id = tenant_id;
    }

    // Buscar o estado ANTES da atualização para comparar o status
    const appointmentBeforeUpdate = await Appointment.findOne(query).lean(); // .lean() para objeto JS puro
    if (!appointmentBeforeUpdate) {
      return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
    }

    const updatedAppointment = await Appointment.findOneAndUpdate(
      query,
      { ...updateData, updated_by: updater_user_id }, // Adiciona quem atualizou
      { new: true, runValidators: true }
    )
    .populate('patient_id', 'name owner_id prontuarioId') // Inclui owner_id e prontuarioId do pet
    .populate('owner_id', 'displayName email full_name')
    .populate('associated_vet_id', 'displayName')
    .populate('serviceId', 'name type price durationMinutes required_specialty'); // Popula o serviceId para ter o tipo

    if (!updatedAppointment) {
      // Isso não deveria acontecer se appointmentBeforeUpdate foi encontrado, mas como fallback.
      return res.status(404).json({ success: false, message: 'Agendamento não encontrado após tentativa de atualização.' });
    }

    // LÓGICA DE CRIAÇÃO DE EPISÓDIO
    // Status que aciona a criação do episódio (Firebase era 'arrived', nosso é 'Chegou')
    const triggerStatusForEpisodeCreation = 'Chegou'; 

    if (updatedAppointment.status === triggerStatusForEpisodeCreation && 
        appointmentBeforeUpdate.status !== triggerStatusForEpisodeCreation) {
        
        // Verifica se o serviço é clínico. Usa o serviceId populado.
        const service = updatedAppointment.serviceId; // Já populado

        if (service && service.type === 'clinical') { // 'clinical' conforme nosso Service model
            console.log(`[AppointmentController] Status mudou para '${triggerStatusForEpisodeCreation}' e serviço é clínico. Tentando criar episódio...`);
            
            const episodeData = {
                tenant_id: updatedAppointment.tenant_id.toString(),
                patient_id: updatedAppointment.patient_id._id.toString(),
                owner_id: updatedAppointment.patient_id.owner_id.toString(), // Obtido do pet populado
                appointmentId: updatedAppointment._id.toString(),
                collaboratorId: updatedAppointment.associated_vet_id?._id?.toString() || null,
                serviceId: service._id.toString(),
                service_name: service.name,
                specialty_id: updatedAppointment.specialty_id || service.required_specialty || null,
                created_by: updater_user_id.toString(), // Quem fez o check-in
            };
            
            try {
                // Checar se já existe um episódio para este agendamento para evitar duplicidade
                // Esta checagem pode ser movida para dentro de createEpisodeInternal se fizer mais sentido.
                const existingEpisode = await mongoose.model('Episode').findOne({ appointmentId: updatedAppointment._id });
                if (!existingEpisode) {
                    await createEpisodeInternal(episodeData);
                    console.log(`[AppointmentController] Solicitação de criação de episódio para appointment ${updatedAppointment._id} enviada.`);
                } else {
                    console.log(`[AppointmentController] Episódio para appointment ${updatedAppointment._id} já existe (ID: ${existingEpisode._id}). Criação pulada.`);
                }
            } catch (episodeError) {
                console.error(`[AppointmentController] Falha ao tentar criar episódio para appointment ${updatedAppointment._id}:`, episodeError);
                // Não retorna erro fatal para o update do agendamento, mas loga.
                // Pode-se adicionar um campo no agendamento para indicar falha na criação do episódio.
            }
        } else {
            console.log(`[AppointmentController] Status mudou para '${triggerStatusForEpisodeCreation}' mas serviço não é clínico (tipo: ${service?.type}) ou serviço não encontrado. Episódio não criado.`);
        }
    }

    res.status(200).json({ success: true, appointment: updatedAppointment });

  } catch (error) {
    return handleAppointmentError(res, error, 'atualizar agendamento');
  }
};

// --- DELETE /api/appointments/:id --- (Delete/Cancel Appointment)
export const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id;
  const { cancellation_reason } = req.body;
  console.log(`Received request to delete/cancel appointment ${id}`);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'ID de agendamento inválido.' });
  }
   if (!tenant_id && req.user.role !== 'superAdmin') {
      return res.status(403).json({ success: false, message: 'Usuário sem tenant associado ou não autorizado.'});
  }

  try {
    const query = { _id: id, status: { $ne: 'Cancelado' } }; // Só cancela se não estiver cancelado
    if (tenant_id) {
      query.tenant_id = tenant_id; // Adiciona filtro de tenant se não for superAdmin
    }

    const update = { 
      status: 'Cancelado', 
      cancellationReason: cancellation_reason || 'Cancelado via API'
    };

    const cancelledAppointment = await Appointment.findOneAndUpdate(
      query,
      update,
      { new: true } // Retorna o documento atualizado
    );
    
    if (!cancelledAppointment) {
       return res.status(404).json({ success: false, message: 'Agendamento não encontrado ou já cancelado.' });
    }

    console.log(`Appointment ${id} inactivated successfully.`); // Corrected log message
    res.status(200).json({ success: true, message: 'Agendamento cancelado com sucesso.', appointment: cancelledAppointment });

  } catch (error) {
    return handleAppointmentError(res, error, `cancelar agendamento ${id}`);
  }
}; 