import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https"; // SDK v2
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Interface para os dados esperados do frontend ao atualizar
interface UpdateTenantData {
    company_name?: string;
    legal_name?: string;
    document_type?: string;
    document?: string;
    responsible_name?: string;
    email?: string;
    phone?: string;
    address?: {
        cep?: string;
        street?: string;
        number?: string;
        complement?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    };
    inscricao_estadual?: string;
    inscricao_municipal?: string;
    cnae_principal?: string;
    regime_tributario?: string;
    // Adicione aqui outros campos que são editáveis através da página Settings.jsx
    // IMPORTANTE: Não inclua campos que não devem ser alterados por esta função,
    // como status, adminAuthUid, created_at, id, etc., a menos que seja intencional
    // e com as devidas verificações de permissão.
}

interface UpdateTenantCallableData {
    tenantId: string;
    updates: UpdateTenantData;
}

/**
 * Atualiza os dados de um tenant existente no Firestore usando Firebase Functions SDK v2.
 * Apenas os campos fornecidos no objeto 'updates' serão modificados.
 */
export const updateTenantSettings = onCall(
    { 
        region: "southamerica-east1",
        cors: ["http://localhost:5173", "https://petclinic-14d1f.web.app"] // Adicione seu domínio de produção aqui também
    }, 
    async (request: CallableRequest<UpdateTenantCallableData>) => {
        logger.info("[updateTenantSettings V2] Iniciando atualização para o tenant ID:", request.data.tenantId, { updates: request.data.updates });

        // 1. Verificação de autenticação
        if (!request.auth) {
            logger.error("[updateTenantSettings V2] Usuário não autenticado.");
            throw new HttpsError("unauthenticated", "Você precisa estar autenticado para realizar esta ação.");
        }

        const { tenantId, updates } = request.data;

        // 2. Validação dos argumentos
        if (!tenantId) {
            logger.error("[updateTenantSettings V2] Tenant ID não fornecido.");
            throw new HttpsError("invalid-argument", "O ID do Tenant é obrigatório para a atualização.");
        }

        if (!updates || Object.keys(updates).length === 0) {
            logger.warn("[updateTenantSettings V2] Nenhum dado fornecido para atualização.", { tenantId });
            return { success: true, message: "Nenhum dado para atualizar." };
        }
        
        // 3. Verificação de permissão (Exemplo: o UID autenticado deve ser o admin do tenant ou um superAdmin)
        // Esta é uma verificação crucial. Você precisa adaptar esta lógica à sua estrutura de permissões.
        // Por exemplo, se o adminAuthUid do tenant deve corresponder ao request.auth.uid:
        // const tenantDocForPermission = await admin.firestore().collection("tenants").doc(tenantId).get();
        // if (!tenantDocForPermission.exists || tenantDocForPermission.data()?.adminAuthUid !== request.auth.uid) {
        //    // Adicionar verificação para Super Admin aqui se necessário
        //    logger.error("[updateTenantSettings V2] Permissão negada.", { tenantId, authUid: request.auth.uid });
        //    throw new HttpsError("permission-denied", "Você não tem permissão para atualizar este tenant.");
        // }
        // Por enquanto, vamos assumir que a chamada do frontend já garante que o usuário logado é o correto
        // Mas em um cenário de produção, a verificação de permissão no backend é vital.

        try {
            const tenantRef = admin.firestore().collection("tenants").doc(tenantId);

            // Opcional: Verificar se o tenant existe antes de tentar atualizar (update não falha se não existir, mas pode ser bom saber)
            const docSnapshot = await tenantRef.get();
            if (!docSnapshot.exists) {
                logger.error("[updateTenantSettings V2] Tenant não encontrado para atualização:", tenantId);
                throw new HttpsError("not-found", "Tenant especificado não foi encontrado.");
            }

            // 4. Construir o objeto de atualização apenas com os campos permitidos e fornecidos
            // Isso evita que campos não intencionais sejam passados ou que 'undefined' limpe campos existentes.
            const allowedUpdates: Partial<UpdateTenantData & { updated_at: FirebaseFirestore.FieldValue }> = {};

            // Mapear apenas os campos permitidos e que foram realmente enviados
            if (updates.company_name !== undefined) allowedUpdates.company_name = updates.company_name;
            if (updates.legal_name !== undefined) allowedUpdates.legal_name = updates.legal_name;
            if (updates.document_type !== undefined) allowedUpdates.document_type = updates.document_type;
            if (updates.document !== undefined) allowedUpdates.document = updates.document;
            if (updates.responsible_name !== undefined) allowedUpdates.responsible_name = updates.responsible_name;
            if (updates.email !== undefined) allowedUpdates.email = updates.email;
            if (updates.phone !== undefined) allowedUpdates.phone = updates.phone;
            if (updates.address !== undefined) allowedUpdates.address = updates.address; // Atualiza o mapa de endereço inteiro se fornecido
            if (updates.inscricao_estadual !== undefined) allowedUpdates.inscricao_estadual = updates.inscricao_estadual;
            if (updates.inscricao_municipal !== undefined) allowedUpdates.inscricao_municipal = updates.inscricao_municipal;
            if (updates.cnae_principal !== undefined) allowedUpdates.cnae_principal = updates.cnae_principal;
            if (updates.regime_tributario !== undefined) allowedUpdates.regime_tributario = updates.regime_tributario;
            
            // Adicionar outros campos conforme necessário, seguindo o mesmo padrão.

            if (Object.keys(allowedUpdates).length === 0) {
                logger.warn("[updateTenantSettings V2] Nenhum campo válido para atualização após filtragem.", { tenantId, originalUpdates: updates });
                return { success: true, message: "Nenhum campo válido para atualizar." };
            }
            
            // Adicionar timestamp de atualização
            allowedUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();

            // 5. Executar a atualização
            await tenantRef.update(allowedUpdates);

            logger.info("[updateTenantSettings V2] Tenant atualizado com sucesso:", tenantId);
            return { success: true, message: "Dados da empresa atualizados com sucesso!" };

        } catch (error: any) {
            logger.error("[updateTenantSettings V2] Erro ao atualizar tenant:", tenantId, { error: error.message, details: error.details });
            if (error instanceof HttpsError) {
                throw error;
            }
            // Retornar um erro genérico para o cliente, mas logar o detalhe
            throw new HttpsError("internal", "Ocorreu um erro interno ao tentar atualizar os dados da empresa.", error.message);
        }
    }
); 