/* eslint-env node */
import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs'; // bcrypt não é mais necessário aqui diretamente
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'node:process';

// Configure dotenv to find .env in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import User model and connectDB function (adjust paths as necessary)
import User from '../src/models/user.model.js';
import connectDB from '../src/config/database.js';

const superAdminEmail = 'cadu.eduardo@gmail.com';
const superAdminPassword = 'C@du27140797'; // NOVA SENHA PARA TESTE DEFINITIVO
const superAdminDisplayName = 'Cadu Eduardo (Super Admin)';

const seedSuperAdmin = async () => {
  console.log('Connecting to DB...');
  await connectDB();
  console.log('DB Connected.');

  try {
    // Attempt to delete the existing Super Admin user first
    console.log(`Attempting to delete user: ${superAdminEmail}`);
    const deleteResult = await User.deleteOne({ email: superAdminEmail });
    console.log(`Deletion result for ${superAdminEmail}: acknowledged: ${deleteResult.acknowledged}, deletedCount: ${deleteResult.deletedCount}`);

    // Create the new Super Admin user with the plain text password
    // The pre('save') hook in user.model.js will handle hashing.
    console.log(`Attempting to create new Super Admin ${superAdminEmail} with plain password.`);
    const superAdmin = new User({
      email: superAdminEmail,
      password: superAdminPassword, // Passar a senha em TEXTO PLANO aqui
      displayName: superAdminDisplayName,
      role: 'superAdmin',
      status: 'active',
      tenantId: null,
    });
    await superAdmin.save(); // O hook pre-save fará o hash
    console.log(`Super Admin ${superAdminEmail} created successfully (password hashed by model)!`);

  } catch (error) {
    console.error('Error seeding Super Admin (delete then create with model hashing):', error);
    process.exit(1); // Exit with error code
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
};

seedSuperAdmin(); 