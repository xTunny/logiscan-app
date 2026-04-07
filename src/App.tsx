/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
// Usamos la librería que tu proyecto reconoce para evitar el error de Rollup
import { GoogleGenAI } from "@google/genai";
import { 
  FileText, Upload, Copy, Check, Loader2, AlertCircle, Package, User, 
  Calendar, ClipboardList, ArrowRight, Camera, LayoutDashboard, Truck, 
  Users, Clock, ChevronRight, Save, AlertTriangle, Search, Plus, 
  LogOut, Menu, X, ArrowLeft, Edit3, CheckCircle2, MoreVertical, 
  Trash2, Download, BarChart3
} from 'lucide-react';
// Usamos la ruta original de animaciones
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged, 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, getDocs, User as FirebaseUser
} from './firebase';

// INICIALIZACIÓN CON TU API KEY REAL
const genAI = new GoogleGenAI({ apiKey: "AIzaSyA323E4zyCs2_Qrpz7nHzIWYa3DrA8vYcw" });

// --- Interfaces ---
interface Suplidor { id: string; nombre: string; }
interface Conduce {
  id: string; conduce_nro: string; fecha: string; fecha_recepcion?: string;
  suplidor_id: string; entregado_por: string; recibido_por: string;
  estado: 'pendiente_auditoria' | 'completado' | 'con_faltantes';
  foto_url?: string; suplidor_nombre?: string;
}
interface Item {
  id: string; conduce_id: string; descripcion: string; cantidad_impresa: number;
  cantidad_recibida: number | null; unidad: string; novelty_detected: boolean; auditado: boolean;
}

// --- Componentes ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  if (hasError) return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Algo salió mal</h2>
        <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-red-700 transition-colors mt-4">Reiniciar Aplicación</button>
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
    const unsubC = onSnapshot(query(collection(db, 'conduces'), orderBy('fecha', 'desc')), (snapshot) => {
      setConduces(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conduce)));
    });
    const unsubS = onSnapshot(query(collection(db, 'suplidores'), orderBy('nombre')), (snapshot) => {
      setSuplidores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suplidor)));
    });
    return () => { unsubC(); unsubS(); };
  }, [user]);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); } };
  const handleLogout = () => auth.signOut();

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
        <div className="bg-blue-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"><FileText className="w-10 h-10 text-blue-600" /></div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">LogiScan AI</h1>
        <p className="text-slate-500 mb-8">Digitalización Inteligente de Conduces</p>
        <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98]">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" /> Iniciar con Google
        </button>
      </motion.div>
    </div>
  );

  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button onClick={() => { if (id === 'audit') setSelectedConduce(null); setView(id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon className="w-5 h-5" /> <span className="font-medium">{label}</span>
      {view === id && <motion.div layoutId="active" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
    </button>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 sticky top-0 h-screen">
          <div className="flex items-center gap-3 mb-10"><div className="bg-blue-600 p-2 rounded-xl"><FileText className="text-white w-6 h-6" /></div><h1 className="text-xl font-bold text-slate-800">LogiScan <span className="text-blue-600">AI</span></h1></div>
          <nav className="flex-1 space-y-2">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" /><NavItem id="capture" icon={Camera} label="Captura Móvil" /><NavItem id="audit" icon={ClipboardList} label="Auditoría" /><NavItem id="pendings" icon={Clock} label="Pendientes" /><NavItem id="suppliers" icon={Truck} label="Suplidores" /><NavItem id="history" icon={Clock} label="Historial" /><NavItem id="report" icon={BarChart3} label="Reporte" />
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-4"><img src={user.photoURL || ""} className="w-10 h-10 rounded-full border border-slate-200" alt="A" /><div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{user.displayName}</p><p className="text-xs text-slate-500 truncate">{user.email}</p></div></div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-semibold"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
          </div>
        </aside>
        <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-auto">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <motion.div key="db" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Dashboard conduces={conduces} setView={setView} setSelectedConduce={setSelectedConduce} /></motion.div>}
            {view === 'capture' && <motion.div key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Capture user={user} setView={setView} setSelectedConduce={setSelectedConduce} /></motion.div>}
            {view === 'audit' && <motion.div key="aud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Audit selectedConduce={selectedConduce} setSelectedConduce={setSelectedConduce} setView={setView} /></motion.div>}
            {view === 'suppliers' && <motion.div key="sup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Suppliers suplidores={suplidores} /></motion.div>}
            {view === 'pendings' && <motion.div key="pen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Pendings user={user} /></motion.div>}
            {view === 'history' && <motion.div key="his" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><History conduces={conduces} /></motion.div>}
            {view === 'report' && <motion.div key="rep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Reports conduces={conduces} /></motion.div>}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Vistas Detalladas con Estética Original ---

function Dashboard({ conduces, setView, setSelectedConduce }: any) {
  const stats = {
    total: conduces.length,
    pendientes: conduces.filter((c: any) => c.estado === 'pendiente_auditoria').length,
    completados: conduces.filter((c: any) => c.estado === 'completado').length,
    faltantes: conduces.filter((c: any) => c.estado === 'con_faltantes').length
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center"><div><h2 className="text-2xl font-bold text-slate-800">Dashboard Principal</h2><p className="text-slate-500 text-sm">Resumen de operaciones de almacén</p></div><button onClick={() => setView('capture')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"><Plus className="w-5 h-5" /> Nueva Captura</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={FileText} label="Total Conduces" value={stats.total} color="blue" />
        <StatCard icon={AlertTriangle} label="Pendientes" value={stats.pendientes} color="amber" />
        <StatCard icon={CheckCircle2} label="Completados" value={stats.completados} color="green" />
        <StatCard icon={Clock} label="Con Faltantes" value={stats.faltantes} color="red" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h3 className="font-bold text-slate-800">Entradas Recientes</h3><button className="text-blue-600 text-sm font-semibold hover:underline">Ver todo</button></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-4">Conduce #</th><th className="px-6 py-4">Suplidor</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acción</th></tr></thead><tbody className="divide-y divide-slate-100">
          {conduces.slice(0, 5).map(c => (
            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => { setSelectedConduce(c); setView('audit'); }}>
              <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">#{c.conduce_nro}</td>
              <td className="px-6 py-4 text-sm text-slate-600 font-medium">{c.suplidor_nombre}</td>
              <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${c.estado === 'pendiente_auditoria' ? 'bg-amber-100 text-amber-700' : c.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.estado.replace('_', ' ')}</span></td>
              <td className="px-6 py-4 text-right"><ChevronRight className="w-5 h-5 text-slate-300 inline" /></td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors: any = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600' };
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon className="w-6 h-6" /></div>
      <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div>
    </div>
  );
}

function Capture({ user, setView, setSelectedConduce }: any) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processIA = async () => {
    if (!image) return; setLoading(true);
    try {
      const prompt = "Analiza este documento y devuelve JSON puro: { suplidor: { nombre: '' }, registro: { fecha: '', conduce_nro: '', entregado_por: '' }, items: [ { descripcion: '', cantidad_impresa: 0, unidad: '', novedad_detectada: false } ] }";
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }, { inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }] }]
      });
      const data = JSON.parse(result.text.replace(/```json|```/g, "").trim());
      const cId = `C_${Date.now()}`;
      const sId = data.suplidor.nombre.toLowerCase().replace(/\s/g, '_');
      await setDoc(doc(db, 'suplidores', sId), { nombre: data.suplidor.nombre, id: sId }, { merge: true });
      const newC = { id: cId, conduce_nro: data.registro.conduce_nro || `SN-${Date.now()}`, fecha: data.registro.fecha || new Date().toISOString(), suplidor_id: sId, suplidor_nombre: data.suplidor.nombre, entregado_por: data.registro.entregado_por || "No indicado", recibido_por: user.displayName, estado: 'pendiente_auditoria', foto_url: image };
      await setDoc(doc(db, 'conduces', cId), newC);
      for (const i of data.items) { await setDoc(doc(db, 'items', `I_${Date.now()}_${Math.random()}`), { ...i, conduce_id: cId, cantidad_recibida: null, auditado: false }); }
      setSelectedConduce(newC); setView('audit');
    } catch (e) { alert("Error al procesar con IA"); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
      {!image ? (
        <div className="text-center py-10"><div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"><Camera className="w-12 h-12 text-blue-600" /></div><h2 className="text-2xl font-bold text-slate-800 mb-2">Captura Móvil</h2><p className="text-slate-500 mb-8">Toma una foto clara del documento para extraer datos con IA.</p><input type="file" accept="image/*" capture="environment" className="hidden" ref={inputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>setImage(r.result as string); r.readAsDataURL(f); }}} /><button onClick={()=>inputRef.current?.click()} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all">Abrir Cámara</button></div>
      ) : (
        <div className="space-y-6">
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-inner bg-slate-100 border border-slate-200"><img src={image} className="w-full h-full object-contain" alt="P" /></div>
          {loading ? <div className="text-center py-4 font-bold text-blue-600 flex flex-col items-center gap-3"><Loader2 className="animate-spin w-10 h-10" /> Procesando con Gemini IA...</div> : <button onClick={processIA} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all"><Save className="w-6 h-6" /> Procesar Información</button>}
          <button onClick={()=>setImage(null)} className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors">Borrar y repetir foto</button>
        </div>
      )}
    </div>
  );
}

function Audit({ selectedConduce, setSelectedConduce, setView }: any) {
  const [items, setItems] = useState<Item[]>([]);
  const [pendings, setPendings] = useState<Conduce[]>([]);
  useEffect(() => {
    if (selectedConduce) return onSnapshot(query(collection(db, 'items'), where('conduce_id', '==', selectedConduce.id)), (s) => setItems(s.docs.map(d => ({id: d.id, ...d.data()} as Item))));
    return onSnapshot(query(collection(db, 'conduces'), where('estado', '==', 'pendiente_auditoria')), (s) => setPendings(s.docs.map(d => ({id: d.id, ...d.data()} as Conduce))));
  }, [selectedConduce]);

  if (!selectedConduce) return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Pendientes de Auditoría</h2>
      <div className="grid grid-cols-1 gap-4">
        {pendings.map(p => (
          <div key={p.id} onClick={() => setSelectedConduce(p)} className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-500 shadow-sm transition-all group">
            <div className="flex items-center gap-4"><div className="bg-amber-100 p-2 rounded-lg text-amber-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors"><Clock className="w-5 h-5" /></div><div><p className="font-bold text-slate-800">#{p.conduce_nro}</p><p className="text-slate-500 text-sm">{p.suplidor_nombre}</p></div></div>
            <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4"><button onClick={() => setSelectedConduce(null)} className="p-2 hover:bg-slate-200 rounded-lg"><ArrowLeft className="w-6 h-6" /></button><div><h2 className="text-2xl font-bold text-slate-800">Auditando Conduce #{selectedConduce.conduce_nro}</h2><p className="text-slate-500">{selectedConduce.suplidor_nombre}</p></div></div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100">
        {items.map(i => (
          <div key={i.id} className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div><p className="font-bold text-slate-800 text-lg">{i.descripcion}</p><p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Esperado: {i.cantidad_impresa} {i.unidad}</p></div>
            <div className="flex items-center gap-4"><span className="text-[10px] font-bold text-slate-400 uppercase">Recibido:</span><input type="number" className="w-24 border border-slate-200 rounded-xl p-3 text-center font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Cant" onChange={(e) => updateDoc(doc(db, 'items', i.id), { cantidad_recibida: Number(e.target.value), auditado: true })} /></div>
          </div>
        ))}
        <div className="p-8 bg-slate-50"><button onClick={async () => { const hasF = items.some(i => (i.cantidad_recibida || 0) < i.cantidad_impresa); await updateDoc(doc(db, 'conduces', selectedConduce.id), { estado: hasF ? 'con_faltantes' : 'completado' }); setSelectedConduce(null); setView('dashboard'); }} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-green-700 transition-all text-lg">Finalizar Auditoría</button></div>
      </div>
    </div>
  );
}

function Suppliers({ suplidores }: any) {
  return ( <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{suplidores.map((s: any) => ( <div key={s.id} className="bg-white p-8 rounded-3xl border border-slate-200 text-center font-bold shadow-sm hover:shadow-md transition-all hover:border-blue-300"><div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600"><Truck className="w-8 h-8" /></div><p className="text-lg text-slate-800">{s.nombre}</p><div className="mt-4 inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] uppercase font-black">Activo</div></div> ))}</div> );
}

function Pendings({ user }: any) {
  const [p, setP] = useState<any[]>([]);
  useEffect(() => { if(user) return onSnapshot(query(collection(db, 'pendientes'), where('estado', '==', 'abierto')), s => setP(s.docs.map(d => ({id: d.id, ...d.data()})))); }, [user]);
  return ( <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-left"><thead className="bg-slate-50 font-bold text-xs text-slate-400 uppercase tracking-wider"><tr><th className="p-6">Producto</th><th className="p-6">Faltante</th><th className="p-6">Suplidor</th></tr></thead><tbody className="divide-y divide-slate-100">{p.map(x => (<tr key={x.id} className="hover:bg-slate-50/50"><td className="p-6 font-bold text-slate-800">{x.descripcion}</td><td className="p-6 text-red-600 font-black">{x.cantidad_faltante}</td><td className="p-6 text-slate-500">{x.suplidor_nombre}</td></tr>))}</tbody></table></div> );
}

function History({ conduces }: any) {
  return ( <div className="max-w-5xl mx-auto space-y-4">{conduces.map((c: any) => ( <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm hover:shadow-md transition-all"><div className="flex items-center gap-4"><div className="bg-slate-50 p-2 rounded-lg text-slate-400"><FileText className="w-6 h-6" /></div><div><p className="font-bold text-slate-800 text-lg">#{c.conduce_nro}</p><p className="text-slate-500 text-sm font-bold uppercase tracking-tighter">{c.suplidor_nombre}</p></div></div><span className={`text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest shadow-sm ${c.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{c.estado.replace('_',' ')}</span></div> ))}</div> );
}

function Reports({ conduces }: any) {
  const exportar = () => { const ws = XLSX.utils.json_to_sheet(conduces); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventario"); XLSX.writeFile(wb, "Reporte_LogiScanAI.xlsx"); };
  return ( <div className="bg-white p-16 rounded-[40px] border border-slate-200 text-center shadow-sm max-w-2xl mx-auto mt-10"><div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-blue-600 shadow-inner"><BarChart3 className="w-12 h-12" /></div><h2 className="text-3xl font-black text-slate-800 mb-4">Exportar Data</h2><p className="text-slate-500 mb-10 text-lg">Descarga todo el historial de operaciones en un archivo Excel profesional para reportes externos.</p><button onClick={exportar} className="bg-blue-600 text-white px-12 py-5 rounded-[20px] font-black text-xl flex gap-4 mx-auto items-center hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"><Download className="w-7 h-7" /> Descargar Historial Excel</button></div> );
}
