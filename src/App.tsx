/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
// Se mantiene la librería original que tu proyecto sí reconoce
import { GoogleGenAI } from "@google/genai";
import { 
  FileText, Upload, Copy, Check, Loader2, AlertCircle, Package, User, 
  Calendar, ClipboardList, ArrowRight, Camera, LayoutDashboard, Truck, 
  Users, Clock, ChevronRight, Save, AlertTriangle, Search, Plus, 
  LogOut, Menu, X, ArrowLeft, Edit3, CheckCircle2, MoreVertical, 
  Trash2, Download, BarChart3
} from 'lucide-react';
// Se mantiene la librería de animaciones original
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged, 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, getDocs, User as FirebaseUser
} from './firebase';

// CONFIGURACIÓN IA CON TU LLAVE
const genAI = new GoogleGenAI({ apiKey: "AIzaSyA323E4zyCs2_Qrpz7nHzIWYa3DrA8vYcw" });

// --- Interfaces de Datos ---[cite: 2]
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

// --- Componente de Errores ---[cite: 2]
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
        <h2 className="text-2xl font-bold">Error de Carga</h2>
        <button onClick={() => window.location.reload()} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl">Reiniciar</button>
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
    const unsubC = onSnapshot(query(collection(db, 'conduces'), orderBy('fecha', 'desc')), (s) => 
      setConduces(s.docs.map(d => ({ id: d.id, ...d.data() } as Conduce))));
    const unsubS = onSnapshot(query(collection(db, 'suplidores'), orderBy('nombre')), (s) => 
      setSuplidores(s.docs.map(d => ({ id: d.id, ...d.data() } as Suplidor))));
    return () => { unsubC(); unsubS(); };
  }, [user]);

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md w-full">
        <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">LogiScan AI</h1>
        <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full mt-6 bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" /> Iniciar con Google
        </button>
      </motion.div>
    </div>
  );

  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button onClick={() => { setView(id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon className="w-5 h-5" /> <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="hidden lg:flex w-72 bg-white border-r p-6 sticky top-0 h-screen flex-col">
          <div className="flex items-center gap-3 mb-10 text-xl font-bold text-slate-800">
            <div className="bg-blue-600 p-2 rounded-xl"><FileText className="text-white w-5 h-5" /></div> LogiScan <span className="text-blue-600">AI</span>
          </div>
          <nav className="flex-1 space-y-2">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="capture" icon={Camera} label="Captura" />
            <NavItem id="audit" icon={ClipboardList} label="Auditoría" />
            <NavItem id="pendings" icon={Clock} label="Pendientes" />
            <NavItem id="suppliers" icon={Truck} label="Suplidores" />
            <NavItem id="history" icon={Clock} label="Historial" />
            <NavItem id="report" icon={BarChart3} label="Reporte" />
          </nav>
          <button onClick={() => auth.signOut()} className="mt-4 text-red-600 font-semibold flex items-center gap-2 px-4 py-2 hover:bg-red-50 rounded-lg"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
        </aside>
        <main className="flex-1 p-6 lg:p-10 overflow-auto">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <Dashboard conduces={conduces} setView={setView} setSelectedConduce={setSelectedConduce} />}
            {view === 'capture' && <Capture user={user} setView={setView} setSelectedConduce={setSelectedConduce} />}
            {view === 'audit' && <Audit selectedConduce={selectedConduce} setSelectedConduce={setSelectedConduce} setView={setView} />}
            {view === 'suppliers' && <Suppliers suplidores={suplidores} />}
            {view === 'pendings' && <Pendings user={user} conduces={conduces} />}
            {view === 'history' && <History conduces={conduces} />}
            {view === 'report' && <Reports conduces={conduces} />}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Componentes Detallados ---[cite: 2]

function Dashboard({ conduces, setView, setSelectedConduce }: any) {
  const stats = {
    total: conduces.length,
    pendientes: conduces.filter((c: any) => c.estado === 'pendiente_auditoria').length,
    completados: conduces.filter((c: any) => c.estado === 'completado').length,
    faltantes: conduces.filter((c: any) => c.estado === 'con_faltantes').length
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Dashboard Principal</h2><button onClick={() => setView('capture')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex gap-2 shadow-lg"><Plus /> Nueva Captura</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={FileText} label="Total Conduces" value={stats.total} color="blue" />
        <StatCard icon={AlertTriangle} label="Pendientes" value={stats.pendientes} color="amber" />
        <StatCard icon={CheckCircle2} label="Completados" value={stats.completados} color="green" />
        <StatCard icon={Clock} label="Faltantes" value={stats.faltantes} color="red" />
      </div>
      
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b font-bold text-slate-800">Entradas Recientes</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
              <tr><th className="p-4">Conduce #</th><th className="p-4">Suplidor</th><th className="p-4">Estado</th><th className="p-4">Acción</th></tr>
            </thead>
            <tbody className="divide-y">
              {conduces.slice(0, 5).map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-700">#{c.conduce_nro}</td>
                  <td className="p-4 text-slate-600">{c.suplidor_nombre}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${c.estado==='completado' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{c.estado.replace('_',' ')}</span></td>
                  <td className="p-4"><button onClick={() => { setSelectedConduce(c); setView('audit'); }} className="text-blue-600 font-bold hover:underline">Auditar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors: any = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600' };
  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon className="w-6 h-6" /></div>
      <div><p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div>
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
      const prompt = "Analiza este documento y extrae JSON: { suplidor: { nombre: '' }, registro: { fecha: '', conduce_nro: '', entregado_por: '' }, items: [ { descripcion: '', cantidad_impresa: 0, unidad: '', novedad_detectada: false } ] }";
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
    } catch (e) { alert("Error de procesamiento con IA."); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-xl border">
      {!image ? (
        <div className="text-center py-10"><Camera className="w-12 h-12 text-blue-600 mx-auto mb-6" /><input type="file" accept="image/*" capture="environment" className="hidden" ref={inputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>setImage(r.result as string); r.readAsDataURL(f); }}} /><button onClick={()=>inputRef.current?.click()} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold shadow-lg">Tomar Foto del Conduce</button></div>
      ) : (
        <div className="space-y-6">
          <img src={image} className="w-full rounded-2xl border shadow-inner" alt="P" />
          {loading ? <div className="text-center font-bold text-blue-600 py-4"><Loader2 className="animate-spin mx-auto mb-2 w-8 h-8" /> Analizando con IA...</div> : <button onClick={processIA} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg">Procesar Información</button>}
          <button onClick={()=>setImage(null)} className="w-full text-slate-400 text-sm">Borrar y repetir</button>
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
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Pendientes de Auditoría</h2>
      {pendings.map(p => ( <div key={p.id} onClick={() => setSelectedConduce(p)} className="bg-white p-5 rounded-2xl border flex justify-between items-center cursor-pointer hover:border-blue-500 shadow-sm transition-all"><div className="flex items-center gap-4"><div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Clock className="w-5 h-5" /></div><div><p className="font-bold">#{p.conduce_nro}</p><p className="text-slate-500 text-sm">{p.suplidor_nombre}</p></div></div><ChevronRight className="text-slate-300" /></div> ))}
    </div>
  );

  return (
    <div className="bg-white p-8 rounded-3xl border shadow-lg space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Auditando #{selectedConduce.conduce_nro}</h2>
      <div className="divide-y">
        {items.map(i => (
          <div key={i.id} className="py-4 flex justify-between items-center">
            <div><p className="font-bold text-slate-800">{i.descripcion}</p><p className="text-xs text-slate-400 font-bold uppercase">Esperado: {i.cantidad_impresa} {i.unidad}</p></div>
            <input type="number" className="w-24 border rounded-xl p-3 text-center font-bold shadow-sm" placeholder="Cant" onChange={(e) => updateDoc(doc(db, 'items', i.id), { cantidad_recibida: Number(e.target.value), auditado: true })} />
          </div>
        ))}
      </div>
      <button onClick={async () => { 
        const hasF = items.some(i => (i.cantidad_recibida || 0) < i.cantidad_impresa);
        await updateDoc(doc(db, 'conduces', selectedConduce.id), { estado: hasF ? 'con_faltantes' : 'completado' });
        setSelectedConduce(null); setView('dashboard'); 
      }} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg">Finalizar Auditoría</button>
    </div>
  );
}

function Suppliers({ suplidores }: any) {
  return ( <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{suplidores.map((s: any) => ( <div key={s.id} className="bg-white p-8 rounded-2xl border text-center font-bold shadow-sm hover:border-blue-300 transition-all"><Truck className="mx-auto mb-3 text-blue-600 w-8 h-8" />{s.nombre}</div> ))}</div> );
}

function Pendings({ user }: any) {
  const [p, setP] = useState<any[]>([]);
  useEffect(() => { if(user) return onSnapshot(query(collection(db, 'pendientes'), where('estado', '==', 'abierto')), s => setP(s.docs.map(d => ({id: d.id, ...d.data()})))); }, [user]);
  return ( <div className="bg-white rounded-3xl border overflow-hidden shadow-sm"><table className="w-full text-left"><thead className="bg-slate-50 font-bold text-xs uppercase"><tr><th className="p-5">Producto</th><th className="p-5">Faltante</th><th className="p-5 text-right">Suplidor</th></tr></thead><tbody className="divide-y">{p.map(x => (<tr key={x.id}><td className="p-5 font-bold text-slate-800">{x.descripcion}</td><td className="p-5 text-red-600 font-black">{x.cantidad_faltante}</td><td className="p-5 text-slate-500 text-right">{x.suplidor_nombre}</td></tr>))}</tbody></table></div> );
}

function History({ conduces }: any) {
  return ( <div className="space-y-3">{conduces.map((c: any) => ( <div key={c.id} className="bg-white p-5 rounded-2xl border flex justify-between items-center shadow-sm"><div className="flex items-center gap-4"><div className="bg-slate-50 p-2 rounded-lg text-slate-600"><FileText className="w-5 h-5" /></div><div><p className="font-bold">#{c.conduce_nro}</p><p className="text-slate-500 text-xs font-bold uppercase">{c.suplidor_nombre}</p></div></div><span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-600 uppercase tracking-tighter">{c.estado.replace('_',' ')}</span></div> ))}</div> );
}

function Reports({ conduces }: any) {
  const exportar = () => { const ws = XLSX.utils.json_to_sheet(conduces); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventario"); XLSX.writeFile(wb, "Reporte_Completo.xlsx"); };
  return ( <div className="bg-white p-12 rounded-3xl border text-center shadow-sm max-w-lg mx-auto"><BarChart3 className="w-16 h-16 text-blue-600 mx-auto mb-6" /><h2 className="text-2xl font-bold mb-4">Exportar Operaciones</h2><p className="text-slate-500 mb-8 text-sm">Descarga el historial completo en formato Excel.</p><button onClick={exportar} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold flex gap-3 mx-auto items-center hover:bg-blue-700 transition-all"><Download className="w-5 h-5" /> Descargar Excel</button></div> );
}
