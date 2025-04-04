/**
 * Validação de CPF - Implementação básica
 */

export const consultarCPF = async (cpf) => {
  try {
    // Aqui você pode integrar com um serviço de terceiros
    // Por enquanto, vamos apenas validar o formato e os dígitos verificadores
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    if (cpfLimpo.length !== 11) {
      throw new Error('CPF deve ter 11 dígitos');
    }

    // Validar primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
    }
    let digito1 = 11 - (soma % 11);
    if (digito1 > 9) digito1 = 0;
    
    if (digito1 !== parseInt(cpfLimpo.charAt(9))) {
      throw new Error('CPF inválido');
    }

    // Validar segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
    }
    let digito2 = 11 - (soma % 11);
    if (digito2 > 9) digito2 = 0;
    
    if (digito2 !== parseInt(cpfLimpo.charAt(10))) {
      throw new Error('CPF inválido');
    }

    // Verificar se não são todos os dígitos iguais
    if (/^(\d)\1+$/.test(cpfLimpo)) {
      throw new Error('CPF inválido');
    }

    return {
      valido: true,
      mensagem: 'CPF válido'
    };
  } catch (error) {
    return {
      valido: false,
      mensagem: error.message
    };
  }
};

export const validateCPF = (cpf) => {
  try {
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    if (cpfLimpo.length !== 11) {
      return false;
    }

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpfLimpo)) {
      return false;
    }

    // Validar primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
    }
    let digito1 = 11 - (soma % 11);
    if (digito1 > 9) digito1 = 0;
    
    if (digito1 !== parseInt(cpfLimpo.charAt(9))) {
      return false;
    }

    // Validar segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
    }
    let digito2 = 11 - (soma % 11);
    if (digito2 > 9) digito2 = 0;
    
    if (digito2 !== parseInt(cpfLimpo.charAt(10))) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

export const formatCPF = (cpf) => {
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  if (cpfLimpo.length <= 3) {
    return cpfLimpo;
  }
  
  if (cpfLimpo.length <= 6) {
    return `${cpfLimpo.substring(0, 3)}.${cpfLimpo.substring(3)}`;
  }
  
  if (cpfLimpo.length <= 9) {
    return `${cpfLimpo.substring(0, 3)}.${cpfLimpo.substring(3, 6)}.${cpfLimpo.substring(6)}`;
  }
  
  return `${cpfLimpo.substring(0, 3)}.${cpfLimpo.substring(3, 6)}.${cpfLimpo.substring(6, 9)}-${cpfLimpo.substring(9, 11)}`;
};