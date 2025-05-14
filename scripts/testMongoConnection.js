/* eslint-env node */
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import Tenant from '../src/models/tenant.model.js';

const runTest = async () => {
  try {
    // 1. Conectar ao MongoDB
    await connectDB();

    // 2. Dados de exemplo para o Tenant
    const exampleTenantData = {
      company_name: 'Clínica Vet Exemplo',
      legal_name: 'Exemplo Veterinária LTDA',
      document_type: 'CNPJ',
      document: '12345678000199',
      responsible_name: 'Dr. Exemplo Silva',
      adminEmail: 'admin@vetexemplo.com',
      email: 'contato@vetexemplo.com',
      phone: '11987654321',
      address: {
        cep: '01001000',
        street: 'Praça da Sé',
        number: '1',
        complement: 'Lado A',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
      },
      business_type: 'Clinica Veterinaria',
      selected_modules: ['agendamento', 'prontuario'],
      access_url: 'vetexemplo.petfacil.app',
      status: 'active',
      subscription_tier: 'premium',
      payment_plan: 'monthly',
      payment_method: 'credit_card',
      adminAuthUid: 'firebaseAuthUidAdminExemplo', // Substituir pelo UID real no futuro
      createdBy: 'superAdminUidExemplo', // Substituir pelo UID real no futuro
    };

    // 3. Verificar se já existe um tenant com o mesmo access_url para evitar duplicatas no teste
    const existingTenant = await Tenant.findOne({ access_url: exampleTenantData.access_url });

    if (existingTenant) {
      console.log(`Tenant com access_url '${exampleTenantData.access_url}' já existe. ID: ${existingTenant._id}`);
      // Opcional: Atualizar o tenant existente ou simplesmente pular a criação
      // await Tenant.updateOne({ _id: existingTenant._id }, { $set: { company_name: "Clínica Vet Exemplo Atualizada" } });
      // console.log('Tenant existente atualizado.');
    } else {
      console.log('Criando novo tenant de exemplo...');
      const newTenant = new Tenant(exampleTenantData);
      await newTenant.save();
      console.log('Novo Tenant de exemplo criado com sucesso:', newTenant);
    }

  } catch (error) {
    console.error('Erro durante o teste de conexão e inserção:', error);
  } finally {
    // 4. Fechar a conexão com o MongoDB
    console.log('Fechando conexão com o MongoDB...');
    await mongoose.disconnect();
    console.log('Conexão fechada.');
  }
};

runTest(); 