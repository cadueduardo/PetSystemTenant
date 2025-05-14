import User from '../models/user.model.js';
import generateToken from '../utils/generateToken.js';
// import mongoose from 'mongoose'; // Removido pois não está sendo usado neste controller

// --- POST /api/auth/login --- (User Login)
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  // ----> LOG 1 <----
  console.log('AuthService LOG: Login attempt received. Email:', email, 'Password:', password);

  if (!email || !password) {
    console.log('AuthService LOG: Email or password missing in request.');
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    // Encontrar usuário pelo email, selecionando o campo password
    const userFromDB = await User.findOne({ email: email.toLowerCase() }).select('+password');
    // ----> LOG 2 <----
    console.log('AuthService LOG: User found in DB (by email):', userFromDB ? userFromDB.email : null);

    // Verificar se usuário existe e se a senha está correta
    if (userFromDB) {
      // ----> LOG 3 <----
      console.log('AuthService LOG: Password from request (for comparison):', password);
      // NUNCA LOGAR A SENHA HASHEADA DO BANCO EM PRODUÇÃO, APENAS PARA DEBUG LOCAL
      // console.log('AuthService LOG: Hashed password from DB:', userFromDB.password);
      
      const isMatch = await userFromDB.matchPassword(password);
      // ----> LOG 4 <----
      console.log('AuthService LOG: Password match result (isMatch):', isMatch);
      
      if (isMatch) {
        // Verificar se o usuário está ativo
        if (userFromDB.status !== 'active') {
          console.log('AuthService LOG: User is not active. Status:', userFromDB.status);
          let message = 'Usuário inativo.';
          if(userFromDB.status === 'pending_invitation') { // Corrigido para userFromDB.status
              message = 'Conta pendente de ativação. Verifique seu email pelo link de convite.';
          } else if (userFromDB.status === 'pending_password_setup') { // Adicionado para o novo status
            message = 'Conta pendente de configuração de senha. Verifique seu email.';
          }
          return res.status(403).json({ message: message });
        }
        
        console.log('AuthService LOG: Login successful. Generating token for user:', userFromDB._id);
        // Gerar o token JWT
        const token = generateToken(userFromDB._id, userFromDB.role, userFromDB.tenantId);

        // Retornar informações do usuário (sem senha) e o token
        return res.status(200).json({
          success: true,
          user: {
            _id: userFromDB._id,
            displayName: userFromDB.displayName,
            email: userFromDB.email,
            role: userFromDB.role,
            tenantId: userFromDB.tenantId,
            // incluir outros campos se necessário (ex: profileId)
          },
          token: token
        });
      } else {
        console.log('AuthService LOG: Password mismatch.');
      }
    } else {
      console.log('AuthService LOG: User not found by email in DB.');
    }

    // Se chegou aqui, ou usuário não encontrado ou senha não confere
    console.log('AuthService LOG: Returning 401 - Credenciais inválidas.');
    return res.status(401).json({ message: 'Credenciais inválidas.' }); // 401 Unauthorized

  } catch (error) {
    console.error('AuthService LOG: Error during login process:', error);
    return res.status(500).json({ message: 'Erro interno durante o login.', error: error.message });
  }
};

// --- POST /api/auth/setup-password --- (Setup initial password via token)
export const setupPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
  }

  // Validação de força da senha (exemplo simples)
  if (newPassword.length < 8) { 
    return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  // TODO: Adicionar validações mais robustas: maiúsculas, minúsculas, números, símbolos.

  try {
    // Encontrar usuário pelo token de setup de senha e verificar se não expirou
    const user = await User.findOne({
      passwordSetupToken: token,
      passwordSetupExpires: { $gt: new Date() } 
    }).select('+passwordSetupToken +passwordSetupExpires'); // Selecionar para limpar depois

    if (!user) {
      return res.status(400).json({ message: 'Token inválido ou expirado. Solicite um novo link ou contate o suporte.' });
    }

    // Definir a nova senha (o hook pre-save no model User fará o hash)
    user.password = newPassword;
    // Limpar os campos do token de setup
    user.passwordSetupToken = undefined;
    user.passwordSetupExpires = undefined;
    // Ativar o usuário
    user.status = 'active';

    await user.save();

    console.log(`Password for user ${user._id} configured successfully via setup token.`);
    
    // Opcional: Logar o usuário automaticamente após configurar a senha
    // const jwtToken = generateToken(user._id, user.role, user.tenantId);
    // Retornar informações do usuário (sem senha) e o token JWT
    // res.status(200).json({
    //   success: true,
    //   message: 'Senha configurada com sucesso!',
    //   user: {
    //     _id: user._id,
    //     displayName: user.displayName,
    //     email: user.email,
    //     role: user.role,
    //     tenantId: user.tenantId,
    //   },
    //   token: jwtToken
    // });

    return res.status(200).json({ success: true, message: 'Senha configurada com sucesso! Você já pode fazer o login.'});

  } catch (error) {
    console.error("Error setting up password:", error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Erro de validação ao salvar nova senha.', errors: error.errors });
    }
    return res.status(500).json({ message: 'Erro interno ao configurar senha.', error: error.message });
  }
};

// TODO: Implement logout, refreshToken controllers if needed 

// REMOVED TEMPORARY TEST ROUTE CONTROLLER

// --- TEMPORARY TEST ROUTE CONTROLLER ---
export const testFindUser = async (req, res) => {
    try {
        // Try finding ALL users 
        const users = await User.find({}); // Find all users

        if (users && users.length > 0) {
            // Map users to exclude password hash
            const usersResponse = users.map(user => ({
                _id: user._id,
                email: user.email,
                role: user.role,
                status: user.status,
                displayName: user.displayName,
                tenantId: user.tenantId
            }));
            res.status(200).json({ 
                success: true, 
                message: `Found ${users.length} users by test route`, 
                users: usersResponse
             });
        } else {
            res.status(404).json({ success: false, message: 'No users found by test route.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error during test find all.', error: error.message });
    }
}; 