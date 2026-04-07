/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
// Ajustado a la librería que ya tenías
import { GoogleGenerativeAI } from "@google/generative-ai";
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
// Ajustado a 'motion/react' como estaba en tu código original
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  auth, 
  db, 
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
  User as FirebaseUser
} from './firebase';

// --- INICIALIZAR GEMINI CON TU LLAVE ---
const genAI = new GoogleGenerativeAI("AIzaSyA323E4zyCs2_Qrpz7nHzIWYa3DrA8vYcw");

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

    // Escuchar cambios en conduces
    const qConduces = query(collection(db, 'conduces'), orderBy('fecha', 'desc'));
    const unsubConduces = onSnapshot(qConduces, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conduce));
      setConduces(data);
    });

    // Escuchar cambios en suplidores
    const qSuplidores = query(collection(db, 'suplidores'), orderBy('nombre'));
    const unsubSuplidores = onSnapshot(qSuplidores, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suplidor));
      setSuplidores(data);
    });

    return () => {
      unsubConduces();
      unsubSuplidores();
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
            <NavItem id="capture" icon={Camera} label="Captura Móvil" />
            <NavItem id="audit" icon={ClipboardList} label="Auditoría" />
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
                <NavItem id="capture" icon={Camera} label="Captura Móvil" />
                <NavItem id="audit" icon={ClipboardList} label="Auditoría" />
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
                <Dashboard conduces={conduces} setView={setView} setSelectedConduce={setSelectedConduce} />
              </motion.div>
            )}
            {view === 'capture' && (
              <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Capture user={user} setView={setView} setSelectedConduce={setSelectedConduce} />
              </motion.div>
            )}
            {view === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Audit selectedConduce={selectedConduce} setSelectedConduce={setSelectedConduce} setView={setView} />
              </motion.div>
            )}
            {view === 'suppliers' && (
              <motion.div key="suppliers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Suppliers suplidores={suplidores} />
              </motion.div>
            )}
            {view === 'pendings' && (
              <motion.div key="pendings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Pendings user={user} conduces={conduces} />
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

// --- Vistas secundarias (Dashboard, Capture, etc.) ---

function Dashboard({ conduces, setView, setSelectedConduce }: { conduces: Conduce[], setView: any, setSelectedConduce: any }) {
  const stats = {
    total: conduces.length,
    pendientes: conduces.filter(c => c.estado === 'pendiente_auditoria').length,
    completados: conduces.filter(c => c.estado === 'completado').length,
    faltantes: conduces.filter(c => c.estado === 'con_faltantes').length
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
        <StatCard icon={FileText} label="Total Conduces" value={stats.total} color="blue" />
        <StatCard icon={AlertTriangle} label="Pendientes Auditoría" value={stats.pendientes} color="amber" />
        <StatCard icon={CheckCircle2} label="Completados" value={stats.completados} color="green" />
        <StatCard icon={Clock} label="Con Faltantes" value={stats.faltantes} color="red" />
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
    if (!image) return;
    setLoading(true);

    try {
      const base64Data = image.split(',')[1];
      // LLAMADA AL MODELO GEMINI FLASH
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Actúa como un experto en logística. Analiza la imagen de este conduce y extrae la información técnica en JSON puro.
Estructura:
{
  "suplidor": { "nombre": "" },
  "registro": { "fecha": "", "conduce_nro": "", "entregado_por": "" },
  "items": [ { "descripcion": "", "cantidad_impresa": 0, "unidad": "", "novedad_detectada": false } ]
}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        }
      ]);

      const response = await result.response;
      const text = response.text().replace(/```json|```/g, "").trim();
      const extraction = JSON.parse(text);
      
      // 1. Manejar Suplidor
      const suplidorNombre = extraction.suplidor.nombre || "Suplidor Desconocido";
      const suplidorId = suplidorNombre.toLowerCase().replace(/\s/g, '_');
      await setDoc(doc(db, 'suplidores', suplidorId), {
        nombre: suplidorNombre,
        id: suplidorId
      }, { merge: true });

      // 2. Crear Conduce
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
        foto_url: image
      };
      await setDoc(doc(db, 'conduces', conduceId), newConduce);

      // 3. Crear Items
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
            <p className="text-slate-500 mb-8">Toma una foto clara del conduce para procesar con IA.</p>
            
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
                  <p className="font-bold text-slate-800">Analizando con IA...</p>
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
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Entregado por</label>
                <input 
                  type="text"
                  value={manualDetails.entregado_por}
                  onChange={(e) => setManualDetails({...manualDetails, entregado_por: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fecha Recepción</label>
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

// ... (Resto de los componentes: Audit, Suppliers, Pendings, History, Reports se mantienen igual)
// Nota: Asegúrate de tener XLSX importado para Reports.
