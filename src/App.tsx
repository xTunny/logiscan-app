/**
 * LogiScan AI - Sistema de Gestión de Almacén
 * Código verificado para despliegue en Vercel
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  FileText, Loader2, AlertCircle, Package, Calendar, ClipboardList,
  ArrowRight, Camera, LayoutDashboard, Truck, Clock, ChevronRight,
  Save, AlertTriangle, Plus, LogOut, Menu, X, ArrowLeft,
  CheckCircle2, Download, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged, 
  collection, doc, setDoc, updateDoc, onSnapshot, query, where, 
  orderBy, getDocs, User as FirebaseUser
} from './firebase';

// --- CONFIGURACIÓN DE IA ---
const genAI = new GoogleGenerativeAI("AIzaSyA323E4zyCs2_Qrpz7nHzIWYa3DrA8vYcw");

// --- INTERFACES ---
interface Suplidor { id: string; nombre: string; }
interface Conduce {
  id: string; conduce_nro: string; fecha: string; fecha_recepcion?: string;
  suplidor_id: string; entregado_por: string; recibido_por: string;
  estado: 'pendiente_auditoria' | 'completado' | 'con_faltantes';
  foto_url?: string; suplidor_nombre?: string;
}
interface Item {
  id: string; conduce_id: string; descripcion: string; cantidad_impresa: number;
  cantidad_recibida: number | null; unidad: string; novedad_detectada: boolean; auditado: boolean;
}

// --- COMPONENTE DE ERROR ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  if (hasError) return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Error de Carga</h2>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-2 rounded-xl">Reiniciar</button>
      </div>
    </div>
  );
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
    const qC = query(collection(db, 'conduces'), orderBy('fecha', 'desc'));
    const unsubC = onSnapshot(qC, (s) => setConduces(s.docs.map(d => ({ id: d.id, ...d.data() } as Conduce))));
    const qS = query(collection(db, 'suplidores'), orderBy('nombre'));
    const unsubS = onSnapshot(qS, (s) => setSuplidores(s.docs.map(d => ({ id: d.id, ...d.data() } as Suplidor))));
    return () => { unsubC(); unsubS(); };
  }, [user]);

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
        <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-6">LogiScan AI</h1>
        <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Iniciar con Google</button>
      </div>
    </div>
  );

  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button onClick={() => { setView(id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${view === id ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
      <Icon className="w-5 h-5" /> <span>{label}</span>
    </button>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="hidden lg:flex w-64 bg-white border-r flex-col p-6 sticky top-0 h-screen">
          <nav className="flex-1 space-y-2">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="capture" icon={Camera} label="Captura" />
            <NavItem id="audit" icon={ClipboardList} label="Auditoría" />
            <NavItem id="pendings" icon={Clock} label="Pendientes" />
            <NavItem id="suppliers" icon={Truck} label="Suplidores" />
            <NavItem id="history" icon={Clock} label="Historial" />
            <NavItem id="report" icon={BarChart3} label="Reporte" />
          </nav>
          <button onClick={() => auth.signOut()} className="text-red-600 font-bold flex gap-2 items-center mt-4"><LogOut className="w-4 h-4" /> Salir</button>
        </aside>
        <main className="flex-1 p-6">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <Dashboard conduces={conduces} setView={setView} setSelectedConduce={setSelectedConduce} />}
            {view === 'capture' && <Capture user={user} setView={setView} setSelectedConduce={setSelectedConduce} />}
            {view === 'audit' && <Audit selectedConduce={selectedConduce} setSelectedConduce={setSelectedConduce} setView={setView} />}
            {view === 'suppliers' && <Suppliers suplidores={suplidores} />}
            {view === 'pendings' && <Pendings user={user} />}
            {view === 'history' && <History conduces={conduces} />}
            {view === 'report' && <Reports conduces={conduces} />}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- SUB-COMPONENTES ---

function Dashboard({ conduces, setView, setSelectedConduce }: any) {
  const stats = { total: conduces.length, pendientes: conduces.filter((c: any) => c.estado === 'pendiente_auditoria').length };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Resumen Almacén</h2><button onClick={() => setView('capture')} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2"><Plus className="w-4 h-4" /> Nuevo</button></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border"> <p className="text-xs text-slate-400 font-bold">TOTAL</p> <p className="text-2xl font-black">{stats.total}</p> </div>
        <div className="bg-white p-4 rounded-xl border"> <p className="text-xs text-slate-400 font-bold">PENDIENTES</p> <p className="text-2xl font-black text-amber-500">{stats.pendientes}</p> </div>
      </div>
    </div>
  );
}

function Capture({ user, setView, setSelectedConduce }: any) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = async () => {
    if (!image) return; setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = "Extrae los datos de este conduce en JSON: { suplidor: { nombre: '' }, registro: { fecha: '', conduce_nro: '', entregado_por: '' }, items: [ { descripcion: '', cantidad_impresa: 0, unidad: '', novedad_detectada: false } ] }";
      const result = await model.generateContent([prompt, { inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }]);
      const response = await result.response;
      const data = JSON.parse(response.text().replace(/```json|```/g, "").trim());
      const cId = `C_${Date.now()}`;
      const sId = data.suplidor.nombre.toLowerCase().replace(/\s/g, '_');
      await setDoc(doc(db, 'suplidores', sId), { nombre: data.suplidor.nombre, id: sId }, { merge: true });
      const newC = { id: cId, conduce_nro: data.registro.conduce_nro || `SN-${Date.now()}`, fecha: data.registro.fecha || new Date().toISOString(), suplidor_id: sId, suplidor_nombre: data.suplidor.nombre, entregado_por: data.registro.entregado_por || "No especificado", recibido_por: user.displayName, estado: 'pendiente_auditoria', foto_url: image };
      await setDoc(doc(db, 'conduces', cId), newC);
      for (const i of data.items) { await setDoc(doc(db, 'items', `I_${Date.now()}_${Math.random()}`), { ...i, conduce_id: cId, cantidad_recibida: null, auditado: false }); }
      setSelectedConduce(newC); setView('audit');
    } catch (e) { alert("Error de procesamiento"); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-lg border">
      {!image ? (
        <div className="text-center py-10"><Camera className="w-12 h-12 text-blue-600 mx-auto mb-4" /><input type="file" capture="environment" accept="image/*" ref={inputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = () => setImage(r.result as string); r.readAsDataURL(f); } }} className="hidden" /><button onClick={() => inputRef.current?.click()} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Tomar Foto</button></div>
      ) : (
        <div className="space-y-4">
          <img src={image} className="w-full rounded-xl" alt="Preview" />
          {loading ? <div className="text-center font-bold text-blue-600"><Loader2 className="animate-spin mx-auto mb-2" /> Leyendo...</div> : <button onClick={process} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Procesar Conduce</button>}
          <button onClick={() => setImage(null)} className="w-full text-slate-400 text-sm">Borrar y repetir</button>
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
      return onSnapshot(q, (s) => setItems(s.docs.map(d => ({id: d.id, ...d.data()} as Item))));
    } else {
      const q = query(collection(db, 'conduces'), where('estado', '==', 'pendiente_auditoria'));
      return onSnapshot(q, (s) => setPendientes(s.docs.map(d => ({id: d.id, ...d.data()} as Conduce))));
    }
  }, [selectedConduce]);

  if (!selectedConduce) return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Pendientes de Auditoría</h2>
      {pendientes.map(p => ( <div key={p.id} onClick={() => setSelectedConduce(p)} className="bg-white p-4 rounded-xl border flex justify-between items-center cursor-pointer hover:border-blue-300"> <p className="font-bold">#{p.conduce_nro}</p> <p className="text-sm">{p.suplidor_nombre}</p> <ChevronRight className="text-slate-300" /> </div> ))}
    </div>
  );

  const finalizar = async () => {
    const faltantes = items.some(i => (i.cantidad_recibida || 0) < i.cantidad_impresa);
    await updateDoc(doc(db, 'conduces', selectedConduce.id), { estado: faltantes ? 'con_faltantes' : 'completado' });
    setSelectedConduce(null); setView('dashboard');
  };

  return (
    <div className="bg-white p-6 rounded-2xl border space-y-4">
      <h2 className="text-xl font-bold">Auditando Conduce #{selectedConduce.conduce_nro}</h2>
      <div className="divide-y">
        {items.map(i => (
          <div key={i.id} className="py-4 flex justify-between items-center">
            <div><p className="font-bold">{i.descripcion}</p><p className="text-xs text-slate-400">Solicitado: {i.cantidad_impresa}</p></div>
            <input type="number" onChange={(e) => updateDoc(doc(db, 'items', i.id), { cantidad_recibida: Number(e.target.value), auditado: true })} className="w-20 border rounded p-2 text-center" placeholder="Cant" />
          </div>
        ))}
      </div>
      <button onClick={finalizar} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Finalizar Auditoría</button>
    </div>
  );
}

function Suppliers({ suplidores }: any) {
  return ( <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{suplidores.map((s: any) => ( <div key={s.id} className="bg-white p-6 rounded-xl border text-center font-bold"><Truck className="mx-auto mb-2 text-blue-600" />{s.nombre}</div> ))}</div> );
}

function Pendings({ user }: any) {
  const [p, setP] = useState<any[]>([]);
  useEffect(() => { if(user) return onSnapshot(query(collection(db, 'pendientes'), where('estado', '==', 'abierto')), s => setP(s.docs.map(d => d.data()))); }, [user]);
  return ( <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-left"><thead className="bg-slate-50"><tr><th className="p-4">Producto</th><th className="p-4">Faltante</th></tr></thead><tbody>{p.map((x, i) => (<tr key={i} className="border-t"><td className="p-4 font-bold">{x.descripcion}</td><td className="p-4 text-red-600">{x.cantidad_faltante}</td></tr>))}</tbody></table></div> );
}

function History({ conduces }: any) {
  return ( <div className="space-y-2">{conduces.map((c: any) => ( <div key={c.id} className="bg-white p-4 rounded-xl border flex justify-between items-center"><p className="font-bold">#{c.conduce_nro}</p><span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold uppercase">{c.estado.replace('_',' ')}</span></div> ))}</div> );
}

function Reports({ conduces }: any) {
  const exportar = () => { const ws = XLSX.utils.json_to_sheet(conduces); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data"); XLSX.writeFile(wb, "Historial_LogiScan.xlsx"); };
  return ( <div className="bg-white p-10 rounded-2xl border text-center"><BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-4" /><h2 className="text-xl font-bold mb-4">Exportar a Excel</h2><button onClick={exportar} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex gap-2 mx-auto"><Download /> Descargar Reporte</button></div> );
}
