{
    "success": true,
    "service": {
        "tenant_id": "6824dd0bec6c3e1434047d1b",
        "name": "Consulta Clínica Geral",
        "description": "Consulta de rotina para avaliação geral da saúde do pet.",
        "type": "clinical",
        "category": "Consultas",
        "durationMinutes": 30,
        "price": 150,
        "points": 0,
        "isActive": true,
        "requiresAppointment": true,
        "applicableSpecies": [
            "dog",
            "cat"
        ],
        "required_specialty": "Clínico Geral",
        "_id": "6824e766ec6c3e1434047d2d",
        "created_at": "2025-05-14T18:56:38.187Z",
        "updated_at": "2025-05-14T18:56:38.187Z",
        "__v": 0
    }
}

{
    "success": true,
    "service": {
        "tenant_id": "6824dd0bec6c3e1434047d1b",
        "name": "Banho e Tosa Higiênica",
        "description": "Banho com produtos neutros e tosa higiênica.",
        "type": "petshop",
        "category": "Estética",
        "durationMinutes": 90,
        "price": 85,
        "points": 0,
        "isActive": true,
        "requiresAppointment": true,
        "applicableSpecies": [
            "dog"
        ],
        "required_specialty": null,
        "_id": "6824e7a2ec6c3e1434047d30",
        "created_at": "2025-05-14T18:57:38.822Z",
        "updated_at": "2025-05-14T18:57:38.822Z",
        "__v": 0
    }
}


Appointments - clinica

{
    "success": true,
    "appointment": {
        "tenant_id": "6824dd0bec6c3e1434047d1b",
        "patient_id": "6824e5e0ec6c3e1434047d2a",
        "owner_id": "6824e4caec6c3e1434047d26",
        "associated_vet_id": null,
        "serviceId": "6824e766ec6c3e1434047d2d",
        "service_name": "Consulta Clínica Geral",
        "appointment_date": "2025-05-21T10:00:00.000Z",
        "duration": 30,
        "end_time": "2025-05-21T10:30:00.000Z",
        "price": 150,
        "status": "Agendado",
        "confirmationStatus": {
            "sent": false,
            "sentAt": null,
            "response": null,
            "responseAt": null
        },
        "check_in_timestamp": null,
        "checkout_timestamp": null,
        "additional_info": "Primeira consulta do Rex para avaliação geral.",
        "cancellationReason": null,
        "specialty_id": "Clínico Geral",
        "requester_type": "Proprietário",
        "referring_clinic_name": null,
        "price_table_id": null,
        "transport_required": false,
        "secondary_procedures_notes": null,
        "created_by_type": "user",
        "created_by": "6824dd0bec6c3e1434047d19",
        "_id": "6824e840ec6c3e1434047d36",
        "created_at": "2025-05-14T19:00:16.570Z",
        "updated_at": "2025-05-14T19:00:16.570Z",
        "__v": 0
    }
}

Status Chegou

{
    "success": true,
    "appointment": {
        "_id": "6824e840ec6c3e1434047d36",
        "tenant_id": "6824dd0bec6c3e1434047d1b",
        "patient_id": {
            "_id": "6824e5e0ec6c3e1434047d2a",
            "owner_id": "6824e4caec6c3e1434047d26",
            "name": "Rex",
            "age": null,
            "id": "6824e5e0ec6c3e1434047d2a"
        },
        "owner_id": {
            "_id": "6824e4caec6c3e1434047d26",
            "email": "tutor.exemplo@email.com",
            "full_name": "Nome Completo do Tutor"
        },
        "associated_vet_id": null,
        "serviceId": {
            "_id": "6824e766ec6c3e1434047d2d",
            "name": "Consulta Clínica Geral",
            "type": "clinical",
            "durationMinutes": 30,
            "price": 150,
            "required_specialty": "Clínico Geral"
        },
        "service_name": "Consulta Clínica Geral",
        "appointment_date": "2025-05-21T10:00:00.000Z",
        "duration": 30,
        "end_time": "2025-05-21T10:30:00.000Z",
        "price": 150,
        "status": "Chegou",
        "confirmationStatus": {
            "sent": false,
            "sentAt": null,
            "response": null,
            "responseAt": null
        },
        "check_in_timestamp": "2025-05-21T09:58:00.000Z",
        "checkout_timestamp": null,
        "additional_info": "Primeira consulta do Rex para avaliação geral.",
        "cancellationReason": null,
        "specialty_id": "Clínico Geral",
        "requester_type": "Proprietário",
        "referring_clinic_name": null,
        "price_table_id": null,
        "transport_required": false,
        "secondary_procedures_notes": null,
        "created_by_type": "user",
        "created_by": "6824dd0bec6c3e1434047d19",
        "created_at": "2025-05-14T19:00:16.570Z",
        "updated_at": "2025-05-14T19:03:02.580Z",
        "__v": 0
    }
}

consulta pet

{
    "success": true,
    "pet": {
        "_id": "6824e5e0ec6c3e1434047d2a",
        "tenant_id": "6824dd0bec6c3e1434047d1b",
        "owner_id": "6824e4caec6c3e1434047d26",
        "name": "Rex",
        "species": "dog",
        "breed": "Labrador",
        "gender": "male",
        "birth_date": "2022-01-15T00:00:00.000Z",
        "photo_url": "http://example.com/rex.jpg",
        "allergies": [
            "Poeira",
            "Frango"
        ],
        "observations": "Adora brincar e buscar a bolinha.",
        "is_inactive": false,
        "date_of_death": null,
        "inactivation_reason": null,
        "health_plan_id": "PLAN123",
        "created_at": "2025-05-14T18:50:08.039Z",
        "updated_at": "2025-05-14T19:03:02.809Z",
        "__v": 0,
        "prontuarioId": "PT-7d1b382809",
        "age": 3,
        "id": "6824e5e0ec6c3e1434047d2a"
    }
}

{
    "success": true,
    "appointment": {
        "_id": "6824e840ec6c3e1434047d36",
        "tenant_id": "6824dd0bec6c3e1434047d1b",
        "patient_id": {
            "_id": "6824e5e0ec6c3e1434047d2a",
            "tenant_id": "6824dd0bec6c3e1434047d1b",
            "owner_id": "6824e4caec6c3e1434047d26",
            "name": "Rex",
            "species": "dog",
            "breed": "Labrador",
            "gender": "male",
            "birth_date": "2022-01-15T00:00:00.000Z",
            "photo_url": "http://example.com/rex.jpg",
            "allergies": [
                "Poeira",
                "Frango"
            ],
            "observations": "Adora brincar e buscar a bolinha.",
            "is_inactive": false,
            "date_of_death": null,
            "inactivation_reason": null,
            "health_plan_id": "PLAN123",
            "created_at": "2025-05-14T18:50:08.039Z",
            "updated_at": "2025-05-14T19:03:02.809Z",
            "__v": 0,
            "prontuarioId": "PT-7d1b382809",
            "age": 3,
            "id": "6824e5e0ec6c3e1434047d2a"
        },
        "owner_id": {
            "_id": "6824e4caec6c3e1434047d26",
            "email": "tutor.exemplo@email.com",
            "phone": "11999998888",
            "full_name": "Nome Completo do Tutor"
        },
        "associated_vet_id": null,
        "serviceId": {
            "_id": "6824e766ec6c3e1434047d2d",
            "tenant_id": "6824dd0bec6c3e1434047d1b",
            "name": "Consulta Clínica Geral",
            "description": "Consulta de rotina para avaliação geral da saúde do pet.",
            "type": "clinical",
            "category": "Consultas",
            "durationMinutes": 30,
            "price": 150,
            "points": 0,
            "isActive": true,
            "requiresAppointment": true,
            "applicableSpecies": [
                "dog",
                "cat"
            ],
            "required_specialty": "Clínico Geral",
            "created_at": "2025-05-14T18:56:38.187Z",
            "updated_at": "2025-05-14T18:56:38.187Z",
            "__v": 0
        },
        "service_name": "Consulta Clínica Geral",
        "appointment_date": "2025-05-21T10:00:00.000Z",
        "duration": 30,
        "end_time": "2025-05-21T10:30:00.000Z",
        "price": 150,
        "status": "Chegou",
        "confirmationStatus": {
            "sent": false,
            "sentAt": null,
            "response": null,
            "responseAt": null
        },
        "check_in_timestamp": "2025-05-21T09:58:00.000Z",
        "checkout_timestamp": null,
        "additional_info": "Primeira consulta do Rex para avaliação geral.",
        "cancellationReason": null,
        "specialty_id": "Clínico Geral",
        "requester_type": "Proprietário",
        "referring_clinic_name": null,
        "price_table_id": null,
        "transport_required": false,
        "secondary_procedures_notes": null,
        "created_by_type": "user",
        "created_by": "6824dd0bec6c3e1434047d19",
        "created_at": "2025-05-14T19:00:16.570Z",
        "updated_at": "2025-05-14T19:03:02.580Z",
        "__v": 0
    }
}


Episodio do agendamento do pet

db.episodes.findOne({ "appointmentId": ObjectId("6824e840ec6c3e1434047d36") })
{
  _id: ObjectId('6824e8e6ec6c3e1434047d41'),
  tenant_id: ObjectId('6824dd0bec6c3e1434047d1b'),
  patient_id: ObjectId('6824e5e0ec6c3e1434047d2a'),
  owner_id: ObjectId('6824e4caec6c3e1434047d26'),
  appointmentId: ObjectId('6824e840ec6c3e1434047d36'),
  collaboratorId: null,
  serviceId: ObjectId('6824e766ec6c3e1434047d2d'),
  service_name: 'Consulta Clínica Geral',
  specialty_id: 'Clínico Geral',
  prontuarioId: 'PT-7d1b382809',
  created_by: ObjectId('6824dd0bec6c3e1434047d19'),
  episodeNumber: 'EP-maob646d',
  status: 'Aguardando Atendimento',
  startTime: ISODate('2025-05-14T19:03:02.824Z'),
  endTime: null,
  clinicalSigns: null,
  anamnesis: null,
  physicalExam: null,
  suspectedDiagnosis: [],
  diagnosis: [],
  treatment: null,
  observations: null,
  prescription: {
    internalMedication: [],
    externalPrescription: [],
    recommendations: ''
  },
  exams: [],
  created_at: ISODate('2025-05-14T19:03:02.828Z'),
  updated_at: ISODate('2025-05-14T19:03:02.828Z'),
  __v: 0
}
rs0 [direct: primary] petfacil_app>