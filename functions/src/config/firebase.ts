import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

initializeApp();
const db = getFirestore();
const auth = admin.auth();
const adminFirestore = admin.firestore;

export { db, auth, adminFirestore, admin }; 