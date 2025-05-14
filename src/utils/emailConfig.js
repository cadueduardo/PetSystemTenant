import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'node:process';

// Configure dotenv para carregar variáveis de ambiente do .env na raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Ajuste o caminho se necessário

const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.EMAIL_PORT || '465', 10),
  secure: (process.env.EMAIL_PORT || '465') === '465', // true for 465, false for other ports like 587
  auth: {
    user: process.env.EMAIL_USER, // Seu email: no-reply@caducas.com.br
    pass: process.env.EMAIL_PASS, // Senha do seu email
  },
  // Opcional: se estiver usando TLS na porta 587
  // tls: {
  //   ciphers:'SSLv3' // Pode ser necessário para alguns provedores
  // }
};

const transporter = nodemailer.createTransport(emailConfig);

/**
 * Envia um email.
 * @param {string} to - Destinatário ou lista de destinatários separados por vírgula.
 * @param {string} subject - Assunto do email.
 * @param {string} html - Corpo do email em HTML.
 * @param {string} [text] - Corpo do email em texto puro (opcional, fallback para HTML).
 * @returns {Promise<object>} - Promessa com o resultado do envio.
 */
export const sendEmail = async (to, subject, html, text) => {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.error('EMAIL_USER ou EMAIL_PASS não configurados nas variáveis de ambiente.');
    // Em um ambiente de desenvolvimento sem credenciais, podemos apenas logar em vez de falhar
    if (process.env.NODE_ENV === 'development') {
      console.log(`---- EMAIL SIMULATION (Dev Mode) ----
      To: ${to}
      Subject: ${subject}
      HTML: ${html}
      Text: ${text || 'N/A'}
      ------------------------------------`);
      return { success: true, messageId: 'simulated-dev-id', message: 'Email simulado em modo de desenvolvimento.' };
    }
    throw new Error('Credenciais de email não configuradas.');
  }

  const mailOptions = {
    from: `"PetFácil" <${emailConfig.auth.user}>`, // Nome do remetente e email
    to: to, // lista de receivers
    subject: subject, // Subject line
    text: text, // plain text body
    html: html, // html body
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error; // Re-throw para ser tratado pelo chamador
  }
};

export default transporter; 