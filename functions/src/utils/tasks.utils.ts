import { CloudTasksClient } from "@google-cloud/tasks";
import * as logger from "firebase-functions/logger";

const tasksClient = new CloudTasksClient();
const project = process.env.GCLOUD_PROJECT;
const location = 'us-central1'; // Ou sua localização de tasks
const queue = 'appointment-notifications'; // Nome da sua fila

// Validação para garantir que project não é undefined
if (!project) {
    logger.error("[TasksUtils] GCLOUD_PROJECT environment variable is not set.");
    throw new Error("GCLOUD_PROJECT environment variable is not set.");
}

const parent = tasksClient.queuePath(project, location, queue); // Construção do parent path

export async function cancelTaskIfExists(taskId: string): Promise<void> {
    const taskPath = `${parent}/tasks/${taskId}`;
    try {
        logger.info(`[TaskCancel] Attempting to delete task: ${taskPath}`);
        await tasksClient.deleteTask({ name: taskPath });
        logger.info(`[TaskCancel] Successfully deleted previous task: ${taskPath}`);
    } catch (error: any) {
        if (error.code === 5) { // 5 = NOT_FOUND
            logger.info(`[TaskCancel] No previous task found with name: ${taskPath}.`);
        } else {
            logger.error(`[TaskCancel] Failed to delete previous task: ${taskPath}`, { error: error.message, errorCode: error.code });
            // TODO: Monitorar/alertar sobre falhas no cancelamento
        }
    }
}

// Exportar tasksClient e parent pode ser útil se outras partes do código precisarem deles diretamente
export { tasksClient, parent }; 