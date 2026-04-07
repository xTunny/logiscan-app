/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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

// --- INICIALIZAR GEMINI ---
const genAI = new GoogleGenerativeAI("AIzaSyA323E4zyCs2_Qrpz7nHzIWYa3DrA8vYcw");

// --- Interfaces ---
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

// --- Error Boundary ---
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
          <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-red-700 transition-colors">
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

  const [conduces, setConduces] = useState<Conduce[]>([]);
  const [suplidores, setSuplidores] = useState<Suplidor[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const qConduces = query(collection(db, 'conduces'), orderBy('fecha', 'desc'));
    const unsubConduces = onSnapshot(qConduces, (snapshot) => {
      setConduces(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conduce)));
    });
    const qSuplidores = query(collection(db, 'suplidores'), orderBy('nombre'));
    const unsubSuplidores = onSnapshot(qSuplidores, (snapshot) => {
      setSuplidores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suplidor)));
    });
    return () => { unsubConduces(); unsubSuplidores(); };
  }, [user]);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); } };
  const handleLogout = () => auth.signOut();

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <div className="bg-blue-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"><FileText className="w-10 h-10 text-blue-600" /></div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">LogiScan AI</h1>
          <p className="text-slate-500 mb-8">Digitalización y Control de Inventario Inteligente</p>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98]">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" /> Iniciar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  const NavItem = ({ id, icon: Icon, label }: { id: typeof view, icon: any, label: string }) => (
    <button onClick={() => { if (id === 'audit') setSelectedConduce(null); setView(id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon className="w-5 h-5" /> <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="hidden lg:flex w-72 bg-white border-r flex-col p-6 sticky top-0 h-screen">
          <div className="flex items-center gap-3 mb-10"><div className="bg-blue-600 p-2 rounded-xl"><FileText className="text-white w-6 h-6" /></div><h1 className="text-xl font-bold text-slate-800">LogiScan <span className="text-blue-600">AI</span></h1></div>
          <nav className="flex-1 space-y-2">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" /><NavItem id="capture" icon={Camera} label="Captura Móvil" /><NavItem id="audit" icon={ClipboardList} label="Auditoría" /><NavItem id="pendings" icon={Clock} label="Pendientes" /><NavItem id="suppliers" icon={Truck} label="Suplidores" /><NavItem id="history" icon={Clock} label="Historial" /><NavItem id="report" icon={BarChart3} label="Reporte" />
          </nav>
          <div className="mt-auto pt-6 border-t"><div className="flex items-center gap-3 mb-4"><img src={user.photoURL || ""} className="w-10 h-10 rounded-full border" alt="A" /><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{user.displayName}</p><p className="text-xs text-slate-500 truncate">{user.email}</p></div></div><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold text-sm"><LogOut className="w-4 h-4" /> Cerrar Sesión</button></div>
        </aside>
        <main className="flex-1 p-4 lg:p-8 overflow-auto pt-20 lg:pt-8">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <motion.div key="db" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Dashboard conduces={conduces} setView={setView} setSelectedConduce={setSelectedConduce} /></motion.div>}
            {view === 'capture' && <motion.div key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Capture user={user} setView={setView} setSelectedConduce={setSelectedConduce} /></motion.div>}
            {view === 'audit' && <motion.div key="aud" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Audit selectedConduce={selectedConduce} setSelectedConduce={setSelectedConduce} setView={setView} /></motion.div>}
            {view === 'suppliers' && <motion.div key="sup" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Suppliers suplidores={suplidores} /></motion.div>}
            {view === 'pendings' && <motion.div key="pen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Pendings user={user} /></motion.div>}
            {view === 'history' && <motion.div key="his" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><History conduces={conduces} /></motion.div>}
            {view === 'report' && <motion.div key="rep" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Reports conduces={conduces} /></motion.div>}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- SUB-COMPONENTS ---

function Dashboard({ conduces, setView, setSelectedConduce }: any) {
  const stats = { total: conduces.length, pendientes: conduces.filter((c: any) => c.estado === 'pendiente_auditoria').length, completados: conduces.filter((c: any) => c.estado === 'completado').length, faltantes: conduces.filter((c: any) => c.estado === 'con_faltantes').length };
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center"><div><h2 className="text-2xl font-bold">Dashboard</h2><p className="text-slate-500">Resumen de almacén</p></div><button onClick={() => setView('capture')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex gap-2"><Plus /> Nueva Captura</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total" value={stats.total} color="blue" /><StatCard icon={AlertTriangle} label="Pendientes" value={stats.pendientes} color="amber" /><StatCard icon={CheckCircle2} label="Completos" value={stats.completados} color="green" /><StatCard icon={Clock} label="Faltantes" value={stats.faltantes} color="red" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600' };
  return ( <div className="bg-white p-6 rounded-2xl border flex items-center gap-4"><div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color as keyof typeof colors]}`}><Icon /></div><div><p className="text-xs font-bold text-slate-400 uppercase">{label}</p><p className="text-2xl font-black">{value}</p></div></div> );
}

function Capture({ user, setView, setSelectedConduce }: any) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'camera' | 'processing' | 'details'>('camera');
  const [manual, setManual] = useState({ entregado: '', fecha: new Date().toISOString().split('T')[0] });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: any) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setImage(reader.result as string); setStep('processing'); }; reader.readAsDataURL(file); } };

  const process = async () => {
    if (!image) return; setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = "Analiza este conduce y extrae JSON: { suplidor: { nombre: '' }, registro: { fecha: '', conduce_nro: '', entregado_por: '' }, items: [ { descripcion: '', cantidad_impresa: 0, unidad: '', novedad_detectada: false } ] }";
      const result = await model.generateContent([prompt, { inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }]);
      const response = await result.response;
      const data = JSON.parse(response.text().replace(/```json|```/g, "").trim());

      const cId = `C_${Date.now()}`;
      const sId = data.suplidor.nombre.toLowerCase().replace(/\s/g, '_');
      await setDoc(doc(db, 'suplidores', sId), { nombre: data.suplidor.nombre, id: sId }, { merge: true });
      const newC = { id: cId, conduce_nro: data.registro.conduce_nro || `SN-${Date.now()}`, fecha: data.registro.fecha || manual.fecha, suplidor_id: sId, suplidor_nombre: data.suplidor.nombre, entregado_por: manual.entregado || data.registro.entregado_por, recibido_por: user.displayName, estado: 'pendiente_auditoria', foto_url: image };
      await setDoc(doc(db, 'conduces', cId), newC);
      for (const i of data.items) { await setDoc(doc(db, 'items', `I_${Date.now()}_${Math.random()}`), { ...i, conduce_id: cId, cantidad_recibida: null, auditado: false }); }
      setSelectedConduce(newC); setView('audit');
    } catch (e) { alert("Error al procesar"); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl border">
      {step === 'camera' ? (
        <div className="text-center"><div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"><Camera className="w-12 h-12 text-blue-600" /></div><h2 className="text-2xl font-bold mb-8">Captura de Conduce</h2><input type="file" accept="image/*" capture="environment" ref={inputRef} onChange={handleCapture} className="hidden" /><button onClick={() => inputRef.current?.click()} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3">Abrir Cámara</button></div>
      ) : (
        <div className="space-y-6">
          <img src={image!} className="w-full rounded-2xl aspect-video object-cover" alt="p" />
          {loading ? <div className="text-center py-4"><Loader2 className="animate-spin mx-auto w-8 h-8 text-blue-600" /><p className="font-bold mt-2">IA Analizando...</p></div> : <button onClick={process} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><Save /> Procesar Documento</button>}
        </div>
      )}
    </div>
  );
}

function Audit({ selectedConduce, setSelectedConduce, setView }: any) {
  const [items, setItems] = useState<Item[]>([]);
  const [pendientes, setPendientes] = useState<Conduce[]>([]);

  useEffect(() => {
    if (selectedConduce) {
      const q = query(collection(db, 'items'), where('conduce_id', '==', selectedConduce.id));
      return onSnapshot(q, (s) => setItems(s.docs.map(d => d.data() as Item)));
    } else {
      const q = query(collection(db, 'conduces'), where('estado', '==', 'pendiente_auditoria'));
      return onSnapshot(q, (s) => setPendientes(s.docs.map(d => ({id: d.id, ...d.data()} as Conduce))));
    }
  }, [selectedConduce]);

  if (!selectedConduce) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Conduces por Auditar</h2>
        {pendientes.map(p => ( <div key={p.id} onClick={() => setSelectedConduce(p)} className="bg-white p-4 rounded-xl border flex justify-between items-center cursor-pointer hover:bg-slate-50"><p className="font-bold">#{p.conduce_nro}</p><p>{p.suplidor_nombre}</p><ChevronRight /></div> ))}
      </div>
    );
  }

  const save = async () => {
    const hasF = items.some(i => (i.cantidad_recibida || 0) < i.cantidad_impresa);
    await updateDoc(doc(db, 'conduces', selectedConduce.id), { estado: hasF ? 'con_faltantes' : 'completado' });
    setSelectedConduce(null); setView('dashboard');
  };

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border">
      <h3 className="text-xl font-bold">Auditando: {selectedConduce.conduce_nro}</h3>
      {items.map(i => (
        <div key={i.id} className="flex justify-between items-center p-3 border-b">
          <div><p className="font-bold">{i.descripcion}</p><p className="text-xs">Esperado: {i.cantidad_impresa}</p></div>
          <input type="number" onChange={async (e) => await updateDoc(doc(db, 'items', i.id), { cantidad_recibida: Number(e.target.value), auditado: true })} className="w-20 border p-2 rounded text-center" placeholder="Cant" />
        </div>
      ))}
      <button onClick={save} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold mt-4">Cerrar Auditoría</button>
    </div>
  );
}

function Suppliers({ suplidores }: any) {
  return ( <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> {suplidores.map((s: any) => ( <div key={s.id} className="bg-white p-6 rounded-2xl border text-center font-bold"> <Truck className="mx-auto mb-2 text-blue-600" /> {s.nombre} </div> ))} </div> );
}

function Pendings({ user }: any) {
  const [pens, setPens] = useState<any[]>([]);
  useEffect(() => { if (!user) return; return onSnapshot(query(collection(db, 'pendientes'), where('estado', '==', 'abierto')), s => setPens(s.docs.map(d => d.data()))); }, [user]);
  return ( <div className="bg-white rounded-2xl border overflow-hidden"> <table className="w-full"> <thead className="bg-slate-50 text-left"> <tr> <th className="p-4">Producto</th> <th className="p-4">Faltante</th> <th className="p-4">Suplidor</th> </tr> </thead> <tbody> {pens.map(p => ( <tr key={p.id} className="border-t"> <td className="p-4 font-bold">{p.descripcion}</td> <td className="p-4 text-red-600">{p.cantidad_faltante}</td> <td className="p-4">{p.suplidor_nombre}</td> </tr> ))} </tbody> </table> </div> );
}

function History({ conduces }: any) {
  return ( <div className="space-y-2"> {conduces.map((c: any) => ( <div key={c.id} className="bg-white p-4 rounded-xl border flex justify-between items-center"><p className="font-bold">#{c.conduce_nro}</p><p className="text-slate-500 text-sm">{c.suplidor_nombre}</p><span className="text-xs bg-slate-100 p-1 rounded uppercase font-bold">{c.estado.replace('_',' ')}</span></div> ))} </div> );
}

function Reports({ conduces }: any) {
  const down = () => { const ws = XLSX.utils.json_to_sheet(conduces); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Report"); XLSX.writeFile(wb, "Reporte.xlsx"); };
  return ( <div className="bg-white p-8 rounded-3xl border text-center"> <BarChart3 className="mx-auto w-12 h-12 text-blue-600 mb-4" /> <h2 className="text-2xl font-bold mb-4">Reportes Excel</h2> <button onClick={down} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex gap-2 mx-auto"><Download /> Descargar Historial</button> </div> );
}
