import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// Importe outros serviços do Firebase que você precisar (ex: getStorage)
// import { getStorage } from "firebase/storage";

// TODO: Substitua este objeto pelos dados de configuração do SEU projeto Firebase!
// NUNCA coloque suas chaves reais diretamente aqui em código versionado.
// Use variáveis de ambiente (veja abaixo).
const firebaseConfigPlaceholder = {
  apiKey: "AIzaSyDZuWuCMWC8pwbtVX6BJdgHO2FRrjh5EiU",
  authDomain: "petclinic-14d1f.firebaseapp.com",
  projectId: "petclinic-14d1f",
  storageBucket: "petclinic-14d1f.firebasestorage.app",
  messagingSenderId: "768612251806",
  appId: "1:768612251806:web:d6eae11aa3fba36d14638f"
  // measurementId: "G-XXXXXXXXXX" // Opcional
};

// --- Abordagem RECOMENDADA: Usando Variáveis de Ambiente (.env) ---
// 1. Crie um arquivo .env na raiz do projeto
// 2. Adicione suas chaves lá, prefixadas com VITE_
//    VITE_FIREBASE_API_KEY=AIzaSy...
//    VITE_FIREBASE_AUTH_DOMAIN=seu-projeto-id.firebaseapp.com
//    VITE_FIREBASE_PROJECT_ID=seu-projeto-id
//    VITE_FIREBASE_STORAGE_BUCKET=seu-projeto-id.appspot.com
//    VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
//    VITE_FIREBASE_APP_ID=1:000000000000:web:...
//    VITE_FIREBASE_MEASUREMENT_ID=G-...
// 3. Certifique-se que .env está no seu .gitignore!
// 4. Descomente o bloco abaixo e use-o em vez do firebaseConfigPlaceholder
/*
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
*/

// Inicializa o Firebase com a configuração (usando placeholder por enquanto)
// TROQUE para firebaseConfig se usar variáveis de ambiente
const app = initializeApp(firebaseConfigPlaceholder); 

// Inicializa os serviços que você usará
const db = getFirestore(app); // Instância do Firestore Database
const auth = getAuth(app);     // Instância do Firebase Authentication
const storage = getStorage(app); // Exemplo se for usar Storage

// Exporta as instâncias dos serviços para serem usadas em outros lugares
export { db, auth, storage }; 