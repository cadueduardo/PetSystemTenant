/**
 * Calcula a idade com base na data de nascimento
 * @param {Date} birthDate - Data de nascimento
 * @returns {string} Idade formatada em anos e meses
 */
export function calculateAge(birthDate) {
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  
  if (years === 0) {
    if (months === 1) {
      return "1 mês";
    }
    return `${months} meses`;
  } else if (years === 1) {
    if (months === 0) {
      return "1 ano";
    } else if (months === 1) {
      return "1 ano e 1 mês";
    }
    return `1 ano e ${months} meses`;
  } else {
    if (months === 0) {
      return `${years} anos`;
    } else if (months === 1) {
      return `${years} anos e 1 mês`;
    }
    return `${years} anos e ${months} meses`;
  }
}