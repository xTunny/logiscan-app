import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocs,
  writeBatch // <-- Añadido aquí para unificar suplidores y borrar en masa
} from 'firebase/firestore';

// 🔥 AÑADIMOS STORAGE para que las fotos de los conduces se guarden sin error
import { 
  getStorage, 
  ref, 
  uploadString, 
  getDownloadURL 
} from 'firebase/storage';

// Configuración final con la API Key correcta verificada
const firebaseConfig = {
  apiKey: "AIzaSyA323E4zyCs2_Qrpz7nHzIWYa3DrA8vYcw", 
  authDomain: "gen-lang-client-0416870184.firebaseapp.com",
  projectId: "gen-lang-client-0416870184",
  storageBucket: "gen-lang-client-0416870184.firebasestorage.app",
  messagingSenderId: "179833945393",
  appId: "1:179833945393:web:de71ce357d94abd00c410"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// EXPORTAR SERVICIOS
export const auth = getAuth(app);

/**
 * IMPORTANTE: Aquí especificamos el ID de la base de datos 
 * donde están tus registros de "conduces" y "Genao Yimy".
 */
export const db = getFirestore(app, "ai-studio-141ffde9-4d74-461d-bc56-722e70891227");

// Inicializar Storage para las fotos
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

// Configurar para que Google siempre pida elegir la cuenta
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { 
  signInWithPopup, 
  onAuthStateChanged, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocs,
  writeBatch, // <-- Exportado aquí
  ref,        // <-- Exportados para Storage
  uploadString,
  getDownloadURL
};

export type { User };
