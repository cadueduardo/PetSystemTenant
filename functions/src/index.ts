import * as logger from "firebase-functions/logger";

// Importações da nova estrutura modular
import {
    CODE_VERSION,
} from "./config/constants";

// Exportação dos módulos de funções
export * from './tenancy';
export * from './waha';
export * from './appointments';
export * from './medical';
export * from './billing';
export * from './orders';
export * from './admin';
export * from './barcodes';

logger.info(`[Function Init] Running code version: ${CODE_VERSION}`);

// --- Fim do arquivo ---