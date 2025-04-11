/**
 * Formats a number as Brazilian Real (BRL) currency.
 * @param {number} value - The number to format.
 * @returns {string} The formatted currency string (e.g., "R$ 50,00").
 */
export function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    console.warn('[formatCurrency] Invalid input value:', value);
    return 'R$ 0,00'; // Return a default value for invalid input
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
} 