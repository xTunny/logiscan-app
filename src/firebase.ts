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
  getDocs 
} from 'firebase/firestore';

// Configuración con la API KEY directa para evitar errores de conexión en Vercel
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUÍ", // <--- PEGA AQUÍ TU LLAVE (LA QUE EMPIEZA CON AIzaSy)
  authDomain: "gen-lang-client-0416870184.firebaseapp.com",
  projectId: "gen-lang-client-0416870184",
  storageBucket: "gen-lang-client-0416870184.firebasestorage.app",
  messagingSenderId: "179833945393",
  appId: "1:179833945393:web:de71ce357d94abd00c410"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Forzar la selección de cuenta de Google
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
  getDocs 
};

export type { User };
