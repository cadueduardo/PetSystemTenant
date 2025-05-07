import * as admin from "firebase-admin"; // Para admin.firestore.Timestamp

export function formatDateTime(timestamp: admin.firestore.Timestamp | undefined): string {
  if (!timestamp) return 'Data/Hora Indisponível';
  const date = timestamp.toDate();
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) +
         ' às ' +
         date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
} 