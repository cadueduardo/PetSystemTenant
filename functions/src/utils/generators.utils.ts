import * as logger from "firebase-functions/logger";

function pad8(num: number): string {
  return String(num).padStart(8, '0');
}

export function generateFormattedId(prefix: string): string {
  const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
  const formattedId = `${prefix}-${pad8(randomNumber)}`;
  logger.info(`[generateFormattedId] Generated ID: ${formattedId} with prefix ${prefix}`);
  return formattedId;
}

// Função Auxiliar Interna para gerar número da OS
export function _internalGenerateOsNumber(tenantId: string): string {
  logger.info(`[_internalGenerateOsNumber] Generating OS number for tenant: ${tenantId}`);
  try {
    const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
    const osNumber = `OS-${pad8(randomNumber)}`;
    logger.info(`[_internalGenerateOsNumber] Generated OS Number: ${osNumber} for tenant ${tenantId}`);
    return osNumber;
  } catch (error: any) {
    logger.error(`[_internalGenerateOsNumber] Error generating OS number for tenant ${tenantId}:`, error);
    // Lançar um erro interno que pode ser pego pela função chamadora
    throw new Error(`Failed to generate OS number: ${error.message}`);
  }
} 