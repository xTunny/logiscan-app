/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  FileText, 
  Upload, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  Package, 
  User, 
  Calendar,
  ClipboardList,
  ArrowRight,
  Camera,
  LayoutDashboard,
  Truck,
  Users,
  Clock,
  ChevronRight,
  Save,
  AlertTriangle,
  Search,
  Plus,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Edit3,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Download,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  auth, 
  db, 
  storage,
  googleProvider, 
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
  ref,
  uploadString,
  getDownloadURL,
  User as FirebaseUser
} from './firebase';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- Helpers ---
const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

// --- Types ---
interface Suplidor {
  id: string;
  nombre: string;
}

interface Conduce {
  id: string;
  conduce_nro: string;
  fecha: string;
  fecha_recepcion?: string;
  suplidor_id: string;
  entregado_por: string;
  recibido_por: string;
  estado: 'pendiente_auditoria' | 'completado' | 'con_faltantes';
  foto_url?: string;
  suplidor_nombre?: string;
}

interface Item {
  id: string;
  conduce_id: string;
  descripcion: string;
  cantidad_impresa: number;
  cantidad_recibida: number | null;
  unidad: string;
  novedad_detectada: boolean;
  auditado: boolean;
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.error?.message || "Unknown error");
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Algo salió mal</h2>
          <p className="text-slate-600 mb-6">{errorInfo}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Reiniciar Aplicación
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [view, setView] = useState<'dashboard' | 'capture' | 'audit' | 'suppliers' | 'history' | 'pendings' | 'report'>('dashboard');
  const [selectedConduce, setSelectedConduce] = useState<Conduce | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data States
  const [conduces, setConduces] = useState<Conduce[]>([]);
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for conduces
    const qConduces = query(collection(db, 'conduces'), orderBy('fecha', 'desc'));
    const unsubConduces = onSnapshot(qConduces, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conduce));
      setConduces(data);
    });

    // Listen for suplidores
    const qSuplidores = query(collection(db, 'suplidores'), orderBy('nombre'));
    const unsubSuplidores = onSnapshot(qSuplidores, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suplidor));
      setSuplidores(data);
    });

    // Listen for pendientes
    const qPendientes = query(collection(db, 'pendientes'), where('estado', '==', 'abierto'));
    const unsubPendientes = onSnapshot(qPendientes, (snapshot) => {
      setPendientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubConduces();
      unsubSuplidores();
      unsubPendientes();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => auth.signOut();

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center"
        >
          <div className="bg-blue-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">LogiScan AI</h1>
          <p className="text-slate-500 mb-8">Digitalización y Control de Inventario Inteligente</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            Iniciar con Google
          </button>
          <p className="mt-6 text-xs text-slate-400">
            Acceso restringido a personal autorizado de almacén.
          </p>
        </motion.div>
      </div>
    );
  }

  const NavItem = ({ id, icon: Icon, label }: { id: typeof view, icon: any, label: string }) => (
    <button
      onClick={() => { 
        if (id === 'audit') setSelectedConduce(null);
        setView(id); 
        setIsSidebarOpen(false); 
      }}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
        ${view === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
      {view === id && <motion.div layoutId="active" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
    </button>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 sticky top-0 h-screen">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-blue-600 p-2 rounded-xl">
              <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">LogiScan <span className="text-blue-600">AI</span></h1>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="audit" icon={ClipboardList} label="Auditoría" />
            <NavItem id="capture" icon={Camera} label="Captura Móvil" />
            <NavItem id="pendings" icon={Clock} label="Pendientes" />
            <NavItem id="suppliers" icon={Truck} label="Suplidores" />
            <NavItem id="history" icon={Clock} label="Historial" />
            <NavItem id="report" icon={BarChart3} label="Reporte" />
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <img src={user.photoURL || ""} className="w-10 h-10 rounded-full border border-slate-200" alt="Avatar" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* Mobile Nav */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600 w-6 h-6" />
            <span className="font-bold text-slate-800">LogiScan AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="fixed top-0 left-0 bottom-0 w-80 bg-white z-[70] p-6 lg:hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-xl font-bold text-slate-800">Menú</h1>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X className="w-6 h-6 text-slate-600" />
                  </button>
                </div>
                <nav className="space-y-2">
                  <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
                  <NavItem id="audit" icon={ClipboardList} label="Auditoría" />
                  <NavItem id="capture" icon={Camera} label="Captura Móvil" />
                  <NavItem id="pendings" icon={Clock} label="Pendientes" />
                  <NavItem id="suppliers" icon={Truck} label="Suplidores" />
                  <NavItem id="history" icon={Clock} label="Historial" />
                  <NavItem id="report" icon={BarChart3} label="Reporte" />
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-auto">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Dashboard conduces={conduces} pendientes={pendientes} setView={setView} setSelectedConduce={setSelectedConduce} />
              </motion.div>
            )}
            {view === 'capture' && (
              <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Capture user={user} setView={setView} setSelectedConduce={setSelectedConduce} />
              </motion.div>
            )}
            {view === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Audit selectedConduce={selectedConduce} setSelectedConduce={setSelectedConduce} setView={setView} conduces={conduces} user={user!} />
              </motion.div>
            )}
            {view === 'pendings' && (
              <motion.div key="pendings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Pendings user={user} pendientes={pendientes} setView={setView} setSelectedConduce={setSelectedConduce} conduces={conduces} />
              </motion.div>
            )}
            {view === 'suppliers' && (
              <motion.div key="suppliers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Suppliers conduces={conduces} />
              </motion.div>
            )}
            {view === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <History conduces={conduces} />
              </motion.div>
            )}
            {view === 'report' && (
              <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Reports conduces={conduces} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Views ---

function Dashboard({ conduces, pendientes, setView, setSelectedConduce }: { conduces: Conduce[], pendientes: any[], setView: any, setSelectedConduce: any }) {
  const stats = {
    total: conduces.length,
    pendientesAuditoria: conduces.filter(c => c.estado === 'pendiente_auditoria').length,
    completados: conduces.filter(c => c.estado === 'completado').length,
    conFaltantes: conduces.filter(c => c.estado === 'con_faltantes').length,
    itemsPendientes: pendientes.reduce((acc, p) => acc + (p.cantidad_faltante || 0), 0)
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Principal</h2>
          <p className="text-slate-500 text-sm">Resumen de operaciones de almacén</p>
        </div>
        <button 
          onClick={() => setView('capture')}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          Nueva Captura
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Pendientes Auditoría" value={stats.pendientesAuditoria} color="amber" />
        <StatCard icon={Clock} label="Con Faltantes" value={stats.conFaltantes} color="red" />
        <StatCard icon={Package} label="Ítems Pendientes" value={stats.itemsPendientes} color="blue" />
        <StatCard icon={CheckCircle2} label="Total Completados" value={stats.completados} color="green" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Entradas Recientes</h3>
          <button className="text-blue-600 text-sm font-semibold hover:underline">Ver todo</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Conduce #</th>
                <th className="px-6 py-4">Suplidor</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conduces.slice(0, 10).map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => { setSelectedConduce(c); setView('audit'); }}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">#{c.conduce_nro}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{c.suplidor_nombre || 'Desconocido'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(c.fecha).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`
                      px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight
                      ${c.estado === 'pendiente_auditoria' ? 'bg-amber-100 text-amber-700' : 
                        c.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                    `}>
                      {c.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="p-2 group-hover:bg-blue-50 rounded-lg text-blue-600 transition-colors inline-block">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {conduces.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No hay registros de entrada aún.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: number, color: 'blue' | 'amber' | 'green' | 'red' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600'
  };
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function Capture({ user, setView, setSelectedConduce }: { user: FirebaseUser, setView: any, setSelectedConduce: any }) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'camera' | 'processing' | 'details'>('camera');
  const [manualDetails, setManualDetails] = useState({
    entregado_por: '',
    fecha_recepcion: new Date().toISOString().split('T')[0]
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setStep('processing');
      };
      reader.readAsDataURL(file);
    }
  };

  const processAndSave = async () => {
    if (!image) {
      alert("Por favor, captura o selecciona una imagen primero.");
      return;
    }
    setLoading(true);

    try {
      // 1. Compress Image
      const compressedImage = await compressImage(image);
      const base64Data = compressedImage.split(',')[1];
      
      const model = "gemini-3-flash-preview";
      const prompt = `Actúa como un experto en logística. Analiza la imagen de este conduce y extrae la información técnica en JSON puro.
Estructura:
{
  "suplidor": { "nombre": "" },
  "registro": { "fecha": "", "conduce_nro": "", "entregado_por": "" },
  "items": [ { "descripcion": "", "cantidad_impresa": 0, "unidad": "", "novedad_detectada": false } ]
}`;

      const response = await genAI.models.generateContent({
        model,
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
          ]
        }],
        config: { responseMimeType: "application/json" }
      });

      let extraction;
      try {
        extraction = JSON.parse(response.text);
      } catch (e) {
        console.error("Error parsing AI response:", response.text);
        alert("Error al procesar la imagen. La IA no devolvió un formato válido. Por favor, intenta de nuevo con una foto más clara.");
        setLoading(false);
        return;
      }
      
      // Validation: If no items, alert user
      if (!extraction.items || extraction.items.length === 0) {
        alert("Documento no reconocido o sin artículos. Intenta otra foto más clara.");
        setLoading(false);
        return;
      }
      
      // 2. Handle Supplier (Simplified)
      const suplidorNombre = extraction.suplidor.nombre || "Suplidor Desconocido";
      const suplidorId = suplidorNombre.toLowerCase().replace(/\s/g, '_');
      await setDoc(doc(db, 'suplidores', suplidorId), {
        nombre: suplidorNombre,
        id: suplidorId
      }, { merge: true });

      // 3. Create Conduce
      const conduceId = `C_${Date.now()}`;
      const newConduce: Conduce = {
        id: conduceId,
        conduce_nro: extraction.registro.conduce_nro || `S/N-${Date.now()}`,
        fecha: extraction.registro.fecha || new Date().toISOString(),
        fecha_recepcion: manualDetails.fecha_recepcion,
        suplidor_id: suplidorId,
        suplidor_nombre: suplidorNombre,
        entregado_por: manualDetails.entregado_por || extraction.registro.entregado_por || "No especificado",
        recibido_por: user.displayName || "Sistema",
        estado: 'pendiente_auditoria',
        foto_url: compressedImage
      };
      await setDoc(doc(db, 'conduces', conduceId), newConduce);

      // 4. Create Items (cantidad_recibida starts as null)
      for (const item of extraction.items) {
        const itemId = `I_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await setDoc(doc(db, 'items', itemId), {
          ...item,
          id: itemId,
          conduce_id: conduceId,
          cantidad_recibida: null,
          auditado: false
        });
      }

      setSelectedConduce(newConduce);
      setView('audit');
    } catch (err) {
      console.error(err);
      alert("Error al procesar el documento. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
        {step === 'camera' ? (
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Captura Móvil</h2>
            <p className="text-slate-500 mb-8">Toma una foto clara del conduce para que la IA extraiga los datos automáticamente.</p>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
              onChange={handleCapture}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              <Camera className="w-6 h-6" />
              Abrir Cámara
            </button>
          </div>
        ) : step === 'processing' ? (
          <div className="space-y-6 text-center">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-inner bg-slate-100">
              <img src={image!} className="w-full h-full object-contain" alt="Preview" />
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="font-bold text-slate-800">Procesamiento Invisible...</p>
                  <p className="text-sm text-slate-500">La IA está "leyendo" el documento</p>
                </div>
              )}
            </div>
            
            {!loading && (
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setStep('camera')}
                  className="py-4 rounded-2xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Repetir Foto
                </button>
                <button 
                  onClick={() => setStep('details')}
                  className="bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 text-center">Detalles de Recepción</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Entregado por (Nombre)</label>
                <input 
                  type="text"
                  value={manualDetails.entregado_por}
                  onChange={(e) => setManualDetails({...manualDetails, entregado_por: e.target.value})}
                  placeholder="Nombre del transportista"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fecha de Recepción</label>
                <input 
                  type="date"
                  value={manualDetails.fecha_recepcion}
                  onChange={(e) => setManualDetails({...manualDetails, fecha_recepcion: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => setStep('processing')}
                className="py-4 rounded-2xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
              >
                Atrás
              </button>
              <button 
                onClick={processAndSave}
                disabled={loading}
                className="bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Procesar Conduce
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Audit({ selectedConduce, setSelectedConduce, setView, conduces, user }: { selectedConduce: Conduce | null, setSelectedConduce: any, setView: any, conduces: Conduce[], user: FirebaseUser }) {
  const [items, setItems] = useState<Item[]>([]);
  const [conducePendings, setConducePendings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entregadoPor, setEntregadoPor] = useState('');
  const [fechaConduce, setFechaConduce] = useState('');

  const conducesPendientes = conduces.filter(c => c.estado === 'pendiente_auditoria' || c.estado === 'con_faltantes');

  useEffect(() => {
    if (selectedConduce) {
      setEntregadoPor(selectedConduce.entregado_por || '');
      try {
        const date = new Date(selectedConduce.fecha);
        setFechaConduce(date.toISOString().split('T')[0]);
      } catch (e) {
        setFechaConduce(new Date().toISOString().split('T')[0]);
      }
    }
  }, [selectedConduce]);

  useEffect(() => {
    if (!selectedConduce) return;
    setLoading(true);
    
    const qItems = query(collection(db, 'items'), where('conduce_id', '==', selectedConduce.id));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
    });

    const qPendings = query(collection(db, 'pendientes'), where('conduce_id', '==', selectedConduce.id), where('estado', '==', 'abierto'));
    const unsubPendings = onSnapshot(qPendings, (snapshot) => {
      setConducePendings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubItems();
      unsubPendings();
    };
  }, [selectedConduce]);

  const updateItemQty = async (itemId: string, qty: number | null) => {
    await updateDoc(doc(db, 'items', itemId), { 
      cantidad_recibida: qty,
      auditado: qty !== null 
    });
  };

  const finalizeAudit = async () => {
    if (!selectedConduce) return;
    setSaving(true);
    
    if (items.some(i => i.cantidad_recibida === null || i.cantidad_recibida < 0)) {
      alert("Por favor, audita todos los items con cantidades válidas.");
      setSaving(false);
      return;
    }

    if (!entregadoPor.trim()) {
      alert("Por favor, ingresa el nombre de quien entrega.");
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();
    
    // Process each item to update pendings or create new ones
    for (const item of items) {
      const recibidoActual = item.cantidad_recibida || 0;
      const faltante = item.cantidad_impresa - recibidoActual;
      
      const existingPending = conducePendings.find(p => p.descripcion === item.descripcion);

      if (faltante > 0) {
        if (existingPending) {
          // If it was already pending, we don't necessarily update it here unless we received more
          // But wait, the Audit view shows the TOTAL received so far?
          // Let's assume Audit view shows the current state of the item.
        } else {
          // Create new pending
          const pendienteId = `P_${Date.now()}_${item.id}`;
          await setDoc(doc(db, 'pendientes', pendienteId), {
            id: pendienteId,
            conduce_id: selectedConduce.id,
            conduce_nro: selectedConduce.conduce_nro,
            suplidor_id: selectedConduce.suplidor_id,
            suplidor_nombre: selectedConduce.suplidor_nombre,
            descripcion: item.descripcion,
            cantidad_original: item.cantidad_impresa,
            cantidad_recibida_inicial: recibidoActual,
            cantidad_faltante: faltante,
            unidad: item.unidad,
            fecha_creacion: now,
            estado: 'abierto',
            historial: []
          });
        }
      } else if (faltante <= 0 && existingPending) {
        // It was pending but now it's complete
        const recienRecibido = item.cantidad_recibida! - (item.cantidad_recibida! - existingPending.cantidad_faltante); // This logic is tricky
        // Let's simplify: if it's in Audit, the user is entering the NEW total received.
        
        await updateDoc(doc(db, 'pendientes', existingPending.id), {
          estado: 'recibido',
          fecha_recepcion_final: now,
          cantidad_faltante: 0,
          historial: [
            ...(existingPending.historial || []),
            {
              fecha: now,
              cantidad_recibida: existingPending.cantidad_faltante,
              recibido_por: user.displayName || "Sistema"
            }
          ]
        });
      }
    }

    // Re-check all items to determine conduce status
    // We need to fetch the latest pendings or just check the items we have
    const hasFaltantes = items.some(i => (i.cantidad_recibida || 0) < i.cantidad_impresa);
    const estado = hasFaltantes ? 'con_faltantes' : 'completado';

    await updateDoc(doc(db, 'conduces', selectedConduce.id), { 
      estado,
      entregado_por: entregadoPor,
      fecha_recepcion: now,
      fecha: new Date(fechaConduce + 'T12:00:00').toISOString()
    });

    setSaving(false);
    setSelectedConduce(null);
    setView('dashboard');
  };

  if (!selectedConduce) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Auditoría de Conduces</h2>
            <p className="text-slate-500 text-sm">Selecciona un documento para iniciar la verificación física</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Conduce #</th>
                  <th className="px-6 py-4">Suplidor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conducesPendientes.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => setSelectedConduce(c)}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">#{c.conduce_nro}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{c.suplidor_nombre || 'Desconocido'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(c.fecha).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
                        Auditar Ahora
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {conducesPendientes.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20 text-green-500" />
                <p>No hay conduces pendientes de auditoría.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => { setSelectedConduce(null); setView('audit'); }} className="p-2 hover:bg-slate-200 rounded-lg">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Auditoría de Conduce</h2>
          <p className="text-slate-500 text-sm">Verifica las cantidades físicas recibidas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Productos Detectados</span>
              <span className="text-xs font-medium text-slate-500">{items.length} líneas</span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const isComplete = item.cantidad_recibida !== null && item.cantidad_recibida >= item.cantidad_impresa;
                return (
                  <div key={item.id} className={`p-4 flex items-center gap-4 transition-colors ${item.auditado ? 'bg-green-50/30' : ''}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{item.descripcion}</p>
                        {item.novedad_detectada && (
                          <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            NOVEDAD IA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Solicitado: {item.cantidad_impresa} {item.unidad}</p>
                      {isComplete && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1">
                          ⚠️ Este producto ya estaba completo, modificarlo puede afectar el registro
                        </p>
                      )}
                    </div>
                      <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Recibido</span>
                        <input 
                          type="number" 
                          value={item.cantidad_recibida === null ? '' : item.cantidad_recibida}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value);
                            if (val !== null && val < 0) return;
                            updateItemQty(item.id, val);
                          }}
                          placeholder="--"
                          className={`
                            w-20 px-3 py-2 rounded-lg border text-center font-bold
                            ${item.cantidad_recibida !== null && item.cantidad_recibida < item.cantidad_impresa ? 'border-red-300 bg-red-50 text-red-700' : 
                              item.cantidad_recibida !== null ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200'}
                          `}
                        />
                      </div>
                      {item.auditado && item.cantidad_recibida !== null && (
                        <CheckCircle2 className={`w-5 h-5 ${item.cantidad_recibida === item.cantidad_impresa ? 'text-green-500' : 'text-amber-500'}`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Resumen del Conduce</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Número:</span>
                <span className="font-bold text-slate-700">#{selectedConduce.conduce_nro}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Suplidor:</span>
                <span className="font-bold text-slate-700">{selectedConduce.suplidor_nombre}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500">Entregado por:</span>
                <input 
                  type="text"
                  value={entregadoPor}
                  onChange={(e) => setEntregadoPor(e.target.value)}
                  placeholder="Nombre del transportista"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500">Fecha Conduce:</span>
                <input 
                  type="date"
                  value={fechaConduce}
                  onChange={(e) => setFechaConduce(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {selectedConduce.fecha_recepcion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha Recepción:</span>
                  <span className="font-bold text-blue-600">{new Date(selectedConduce.fecha_recepcion + 'T00:00:00').toLocaleDateString()}</span>
                </div>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100">
              <button 
                onClick={finalizeAudit}
                disabled={saving || items.some(i => !i.auditado)}
                className={`
                  w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all
                  ${saving || items.some(i => !i.auditado) 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-100'}
                `}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Finalizar Auditoría
              </button>
              {items.some(i => !i.auditado) && (
                <p className="text-[10px] text-center text-amber-600 font-bold mt-2 uppercase">
                  Debes auditar todas las líneas antes de cerrar
                </p>
              )}
            </div>
          </div>

          {selectedConduce.foto_url && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">Evidencia Fotográfica</p>
              <img src={selectedConduce.foto_url} className="w-full rounded-lg" alt="Evidencia" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Pendings({ user, pendientes, setView, setSelectedConduce, conduces }: { user: FirebaseUser | null, pendientes: any[], setView: any, setSelectedConduce: any, conduces: Conduce[] }) {
  // Group by Conduce
  const groupedPendings = pendientes.reduce((acc: any, p) => {
    if (!acc[p.conduce_id]) {
      acc[p.conduce_id] = {
        conduce_nro: p.conduce_nro,
        suplidor_nombre: p.suplidor_nombre,
        items: []
      };
    }
    acc[p.conduce_id].items.push(p);
    return acc;
  }, {});

  const handleGoToAudit = (conduceId: string) => {
    const conduce = conduces.find(c => c.id === conduceId);
    if (conduce) {
      setSelectedConduce(conduce);
      setView('audit');
    } else {
      alert("No se encontró el conduce original.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestión de Pendientes</h2>
          <p className="text-slate-500">Mercancía faltante agrupada por documento original.</p>
        </div>
      </div>
      
      <div className="space-y-6">
        {Object.entries(groupedPendings).map(([conduceId, data]: [string, any]) => (
          <div key={conduceId} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div 
              onClick={() => handleGoToAudit(conduceId)}
              className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors group"
            >
              <div>
                <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">CONDUCE #{data.conduce_nro}</h3>
                <p className="text-xs text-slate-500">{data.suplidor_nombre}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-lg font-bold uppercase">
                  {data.items.length} Pendientes
                </span>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {data.items.map((p: any) => (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div>
                    <p className="font-bold text-slate-700">{p.descripcion}</p>
                    <p className="text-xs text-slate-500">Original: {p.cantidad_original} {p.unidad} | Recibido: {p.cantidad_recibida_inicial}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-black text-lg">-{p.cantidad_faltante}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">{p.unidad}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {pendientes.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20 text-green-500" />
            <p className="font-medium">¡Todo al día! No hay mercancía pendiente.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function History({ conduces }: { conduces: Conduce[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [conduceItems, setConduceItems] = useState<Item[]>([]);
  const [conducePendings, setConducePendings] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!expandedId) return;
    setLoadingDetails(true);
    
    const qItems = query(collection(db, 'items'), where('conduce_id', '==', expandedId));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      setConduceItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
    });

    const qPendings = query(collection(db, 'pendientes'), where('conduce_id', '==', expandedId));
    const unsubPendings = onSnapshot(qPendings, (snapshot) => {
      setConducePendings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingDetails(false);
    });

    return () => {
      unsubItems();
      unsubPendings();
    };
  }, [expandedId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Historial de Operaciones</h2>
      <p className="text-slate-500">Consulta el ciclo de vida completo de cada recepción.</p>

      <div className="space-y-4">
        {conduces.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div 
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  c.estado === 'completado' ? 'bg-green-50 text-green-600' : 
                  c.estado === 'con_faltantes' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {c.estado === 'completado' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-slate-800">#{c.conduce_nro}</p>
                  <p className="text-xs text-slate-500">{c.suplidor_nombre} • Recibido: {c.fecha_recepcion ? new Date(c.fecha_recepcion).toLocaleString() : 'Pendiente'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                  c.estado === 'completado' ? 'bg-green-100 text-green-700' : 
                  c.estado === 'con_faltantes' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {c.estado.replace('_', ' ')}
                </span>
                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expandedId === c.id ? 'rotate-90' : ''}`} />
              </div>
            </div>

            <AnimatePresence>
              {expandedId === c.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 bg-slate-50/30"
                >
                  <div className="p-6 space-y-6">
                    {loadingDetails ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                              <th className="pb-3 pr-4">Artículo</th>
                              <th className="pb-3 px-4">Doc. Original</th>
                              <th className="pb-3 px-4">Recibido Inicial</th>
                              <th className="pb-3 px-4">Recibido Después</th>
                              <th className="pb-3 pl-4 text-right">Estado Final</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {conduceItems.map(item => {
                              const pending = conducePendings.find(p => p.descripcion === item.descripcion);
                              return (
                                <tr key={item.id} className="text-sm">
                                  <td className="py-4 pr-4">
                                    <p className="font-bold text-slate-700">{item.descripcion}</p>
                                    <p className="text-[10px] text-slate-400">Auditado: {c.fecha_recepcion ? new Date(c.fecha_recepcion).toLocaleString() : '--'}</p>
                                  </td>
                                  <td className="py-4 px-4 text-slate-500 font-medium">{item.cantidad_impresa} {item.unidad}</td>
                                  <td className="py-4 px-4">
                                    <span className={`font-bold ${item.cantidad_recibida === item.cantidad_impresa ? 'text-green-600' : 'text-red-600'}`}>
                                      {item.cantidad_recibida || 0} {item.unidad}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4">
                                    {pending && pending.estado === 'recibido' ? (
                                      <div>
                                        <p className="font-bold text-blue-600">+{pending.cantidad_faltante} {pending.unidad}</p>
                                        <p className="text-[10px] text-slate-400">{new Date(pending.fecha_recepcion_final).toLocaleString()}</p>
                                      </div>
                                    ) : pending ? (
                                      <span className="text-amber-500 font-bold italic">Pendiente...</span>
                                    ) : (
                                      <span className="text-slate-300">--</span>
                                    )}
                                  </td>
                                  <td className="py-4 pl-4 text-right">
                                    {item.cantidad_recibida === item.cantidad_impresa || (pending && pending.estado === 'recibido') ? (
                                      <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-lg font-bold">COMPLETO</span>
                                    ) : (
                                      <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-lg font-bold">INCOMPLETO</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center text-xs">
                          <div className="text-slate-500">
                            <span className="font-bold">Entregado por:</span> {c.entregado_por || 'No especificado'}
                          </div>
                          <div className="text-slate-500">
                            <span className="font-bold">Recibido por:</span> {c.recibido_por || 'Sistema'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Suppliers({ conduces }: { conduces: Conduce[] }) {
  const supplierStats: any = {};
  conduces.forEach(c => {
    if (!supplierStats[c.suplidor_nombre]) {
      supplierStats[c.suplidor_nombre] = { 
        nombre: c.suplidor_nombre, 
        total: 0, 
        completos: 0, 
        faltantes: 0,
        conduces: []
      };
    }
    supplierStats[c.suplidor_nombre].total++;
    supplierStats[c.suplidor_nombre].conduces.push(c);
    if (c.estado === 'completado') supplierStats[c.suplidor_nombre].completos++;
    else if (c.estado === 'con_faltantes') supplierStats[c.suplidor_nombre].faltantes++;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Directorio de Suplidores</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(supplierStats).map((s: any) => (
          <div key={s.nombre} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{s.nombre}</h3>
                  <p className="text-xs text-slate-500">{s.total} Conduces totales</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completos</p>
                  <p className="text-lg font-bold text-green-600">{s.completos}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Con Faltantes</p>
                  <p className="text-lg font-bold text-red-600">{s.faltantes}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Conduces Asociados</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {s.conduces.map((c: Conduce) => (
                  <div key={c.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                    <span className="font-mono font-bold text-slate-700">#{c.conduce_nro}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                      c.estado === 'completado' ? 'bg-green-100 text-green-700' : 
                      c.estado === 'con_faltantes' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.estado.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Reports({ conduces }: { conduces: Conduce[] }) {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);

  const downloadExcel = async (type: 'receptions' | 'pendings' | 'history' | 'suppliers') => {
    setExporting(true);
    try {
      let data: any[] = [];
      let filename = `reporte_${type}_${startDate}_a_${endDate}.xlsx`;

      const start = new Date(startDate + 'T00:00:00').toISOString();
      const end = new Date(endDate + 'T23:59:59').toISOString();

      if (type === 'receptions') {
        const filtered = conduces.filter(c => c.fecha_recepcion && c.fecha_recepcion >= start && c.fecha_recepcion <= end);
        data = filtered.map(c => ({
          'Conduce #': c.conduce_nro,
          'Suplidor': c.suplidor_nombre,
          'Fecha Conduce': new Date(c.fecha).toLocaleDateString(),
          'Fecha Recepción': new Date(c.fecha_recepcion!).toLocaleString(),
          'Entregado por': c.entregado_por,
          'Recibido por': c.recibido_por,
          'Estado': c.estado
        }));
      } else if (type === 'pendings') {
        const q = query(collection(db, 'pendientes'), where('fecha_creacion', '>=', start), where('fecha_creacion', '<=', end));
        const snapshot = await getDocs(q);
        data = snapshot.docs.map(doc => {
          const p = doc.data();
          return {
            'Artículo': p.descripcion,
            'Cantidad Faltante': p.cantidad_faltante,
            'Unidad': p.unidad,
            'Suplidor': p.suplidor_nombre,
            'Conduce Ref': p.conduce_id,
            'Fecha Detección': new Date(p.fecha_creacion).toLocaleString(),
            'Estado': p.estado,
            'Fecha Recepción Final': p.fecha_recepcion_final ? new Date(p.fecha_recepcion_final).toLocaleString() : 'Pendiente'
          };
        });
      } else if (type === 'history') {
        const qItems = query(collection(db, 'items'));
        const itemsSnapshot = await getDocs(qItems);
        const allItems = itemsSnapshot.docs.map(d => d.data());
        
        const filteredConduces = conduces.filter(c => c.fecha >= start && c.fecha <= end);
        
        data = filteredConduces.flatMap(c => {
          const cItems = allItems.filter(i => i.conduce_id === c.id);
          return cItems.map(i => ({
            'Conduce #': c.conduce_nro,
            'Suplidor': c.suplidor_nombre,
            'Artículo': i.descripcion,
            'Cant. Documento': i.cantidad_impresa,
            'Cant. Recibida': i.cantidad_recibida || 0,
            'Unidad': i.unidad,
            'Fecha Auditoría': c.fecha_recepcion ? new Date(c.fecha_recepcion).toLocaleString() : 'N/A',
            'Estado Conduce': c.estado
          }));
        });
      } else if (type === 'suppliers') {
        const supplierStats: any = {};
        conduces.forEach(c => {
          if (!supplierStats[c.suplidor_nombre]) {
            supplierStats[c.suplidor_nombre] = { 'Nombre': c.suplidor_nombre, 'Total Conduces': 0, 'Completos': 0, 'Con Faltantes': 0 };
          }
          supplierStats[c.suplidor_nombre]['Total Conduces']++;
          if (c.estado === 'completado') supplierStats[c.suplidor_nombre]['Completos']++;
          else if (c.estado === 'con_faltantes') supplierStats[c.suplidor_nombre]['Con Faltantes']++;
        });
        data = Object.values(supplierStats);
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte");
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting excel:", error);
      alert("Error al exportar el reporte.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Centro de Reportes</h2>
          <p className="text-slate-500">Exporta la data de operaciones a formato Excel para análisis externo.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha Fin</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportButton 
            onClick={() => downloadExcel('receptions')}
            icon={Truck}
            title="Reporte de Recepciones"
            description="Todas las entradas auditadas en el rango de fechas."
            loading={exporting}
          />
          <ReportButton 
            onClick={() => downloadExcel('pendings')}
            icon={Clock}
            title="Reporte de Faltantes"
            description="Detalle de mercancía que no llegó y su estado de recuperación."
            loading={exporting}
          />
          <ReportButton 
            onClick={() => downloadExcel('history')}
            icon={FileText}
            title="Historial Detallado"
            description="Ciclo de vida completo: solicitado vs recibido por artículo."
            loading={exporting}
          />
          <ReportButton 
            onClick={() => downloadExcel('suppliers')}
            icon={BarChart3}
            title="Desempeño de Suplidores"
            description="Estadísticas de cumplimiento por proveedor."
            loading={exporting}
          />
        </div>
      </div>
    </motion.div>
  );
}

function ReportButton({ onClick, icon: Icon, title, description, loading }: { onClick: any, icon: any, title: string, description: string, loading: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
    >
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 shadow-sm transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
          {title}
          <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

