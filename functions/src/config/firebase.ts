import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

// initializeApp(); // REMOVIDO - Inicialização movida para index.ts
const db = getFirestore();
const auth = admin.auth();
const adminFirestore = admin.firestore;

export { db, auth, adminFirestore, admin }; 