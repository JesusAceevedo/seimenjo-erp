'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, Users, Fingerprint, Scan, Settings, Power, HardDrive, Wifi, Bell, History, Trash2, Database, Camera, DoorOpen, AlertTriangle, Info, Terminal, CheckCircle, XCircle, Download } from 'lucide-react';
import type { ZkTecoComando, EmpleadoDetalle } from '../types';
import { loadComandosPendientes, encolarComandoZkTeco } from '../actions';

interface Props {
  empresaId: string | null;
  empleados: EmpleadoDetalle[];
  checadasRaw: any[];
  onSyncTime: () => void;
  syncingTime: boolean;
}

type CategoriaCmd = 'comunicacion' | 'usuarios' | 'huellas' | 'logs' | 'config' | 'sistema';
const CATEGORIAS: { key: CategoriaCmd; label: string; icon: any }[] = [
  { key: 'comunicacion', label: 'Comunicación', icon: Wifi },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'huellas', label: 'Huellas / Rostro', icon: Fingerprint },
  { key: 'logs', label: 'Checadas y Logs', icon: History },
  { key: 'config', label: 'Configuración', icon: Settings },
  { key: 'sistema', label: 'Sistema', icon: Power }
];

interface HistoryEntry {
  id: string;
  comando: string;
  resultado: string;
  timestamp: string;
  ok: boolean;
}

export default function RelojTab({ empresaId, empleados, checadasRaw, onSyncTime, syncingTime }: Props) {
  const [activeCat, setActiveCat] = useState<CategoriaCmd>('comunicacion');
  const [comandos, setComandos] = useState<ZkTecoComando[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sn, setSn] = useState('');

  const handleDownloadExcel = () => {
    if (checadasRaw.length === 0) {
      alert('No hay movimientos registrados para descargar.');
      return;
    }
    
    // Headers: PIN, Nombre, Fecha, Hora, Tipo Evento, Dispositivo SN
    const headers = ['PIN', 'Nombre Empleado', 'Fecha', 'Hora', 'Tipo Evento', 'Dispositivo SN'];
    
    const rows = checadasRaw.map(log => {
      const emp = empleados.find(e => e.zkteco_user_id === log.zkteco_user_id);
      const name = emp ? `${emp.primer_nombre} ${emp.primer_apellido}`.trim() : 'Desconocido';
      const dateObj = new Date(log.timestamp);
      const dateStr = dateObj.toLocaleDateString('es-MX');
      const timeStr = dateObj.toLocaleTimeString('es-MX');
      return [
        log.zkteco_user_id || '',
        name,
        dateStr,
        timeStr,
        log.tipo_evento || '',
        log.dispositivo_sn || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `movimientos_reloj_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Command form states
  const [pinInput, setPinInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [fingerInput, setFingerInput] = useState('');
  const [logStart, setLogStart] = useState('');
  const [logEnd, setLogEnd] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [maskInput, setMaskInput] = useState('');
  const [gatewayInput, setGatewayInput] = useState('');
  const [portInput, setPortInput] = useState('4370');

  useEffect(() => {
    const sns = Array.from(new Set(checadasRaw.map((c: any) => c.dispositivo_sn).filter(Boolean)));
    if (sns.length > 0) setSn(sns[0]);
  }, [checadasRaw]);

  const loadHistory = useCallback(async () => {
    if (!empresaId) return;
    const cmds = await loadComandosPendientes(empresaId, 30);
    setComandos(cmds);
    setHistory(cmds.map((c: ZkTecoComando) => ({
      id: c.comando_id,
      comando: c.comando_texto,
      resultado: c.resultado || (c.procesado ? 'OK' : 'Pendiente'),
      timestamp: c.creado_en,
      ok: c.procesado && c.resultado === '0'
    })));
  }, [empresaId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const sendCmd = async (texto: string, categoria: string) => {
    if (!empresaId) return;
    setSending(true);
    setStatusMsg(`Enviando: ${texto.substring(0, 60)}...`);
    try {
      const id = await encolarComandoZkTeco(empresaId, texto, categoria, sn || undefined);
      setStatusMsg(`✅ Comando encolado (ID: ${id})`);
      await loadHistory();
    } catch (err: any) {
      setStatusMsg(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${sn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Reloj Checador ADMS</h3>
            <p className="text-[10px] text-gray-500">
              {sn ? `SN: ${sn}` : 'Esperando conexión del dispositivo...'} 
              <span className="ml-2 text-gray-400">| ZKTeco MB10-VL</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
            <Download size={14} />
            Descargar Movimientos (Excel)
          </button>
          <button onClick={onSyncTime} disabled={syncingTime}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white transition-colors">
            <Clock size={14} className={syncingTime ? 'animate-spin' : ''} />
            Sincronizar Hora
          </button>
          <button onClick={loadHistory}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors">
            <RefreshCw size={14} /> Recargar
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <Terminal size={14} /> {statusMsg}
        </div>
      )}

      {/* Category Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-px">
        {CATEGORIAS.map(cat => {
          const Icon = cat.icon;
          return (
            <button key={cat.key} onClick={() => setActiveCat(cat.key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs tracking-wider uppercase transition-all whitespace-nowrap ${
                activeCat === cat.key
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              <Icon size={16} /> {cat.label}
            </button>
          );
        })}
      </div>

      {/* Command Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          {activeCat === 'comunicacion' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Comunicación y Sincronización</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button onClick={() => sendCmd('SET OPTIONS DateTime=' + Math.floor(Date.now() / 1000) + ',ServerTZ=-06', 'comunicacion')}
                  disabled={sending} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all text-xs font-semibold">
                  <Clock size={20} className="text-amber-500" />
                  <div className="text-left"><p className="text-gray-900 dark:text-white">Sincronizar Hora y Zona</p><p className="text-[10px] text-gray-400">SET OPTIONS DateTime</p></div>
                </button>
                <button onClick={() => sendCmd('INFO DEVICE', 'comunicacion')}
                  disabled={sending} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all text-xs font-semibold">
                  <Info size={20} className="text-blue-500" />
                  <div className="text-left"><p className="text-gray-900 dark:text-white">Obtener Info Dispositivo</p><p className="text-[10px] text-gray-400">INFO DEVICE</p></div>
                </button>
                <button onClick={() => sendCmd('CMD TESTCONNECTION', 'comunicacion')}
                  disabled={sending} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all text-xs font-semibold">
                  <Wifi size={20} className="text-emerald-500" />
                  <div className="text-left"><p className="text-gray-900 dark:text-white">Probar Conexión</p><p className="text-[10px] text-gray-400">CMD TESTCONNECTION</p></div>
                </button>
                <button onClick={() => sn && sendCmd(`CMD GETSTATE`, 'comunicacion')}
                  disabled={sending || !sn} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all text-xs font-semibold">
                  <Terminal size={20} className="text-purple-500" />
                  <div className="text-left"><p className="text-gray-900 dark:text-white">Obtener Estado</p><p className="text-[10px] text-gray-400">CMD GETSTATE</p></div>
                </button>
              </div>
            </div>
          )}

          {activeCat === 'usuarios' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Gestión de Usuarios</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="col-span-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Actualizar / Crear Usuario en Dispositivo</p>
                  <div className="flex gap-2">
                    <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Nombre" className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <button onClick={() => pinInput && nameInput && sendCmd(
                      `DATA UPDATE USERINFO PIN=${pinInput}\tName=${nameInput}\tPri=0\tPass=\tCard=\tGrp=1`, 'usuarios'
                    )} disabled={sending || !pinInput || !nameInput}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Enviar</button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-2">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Borrar Usuario</p>
                  <div className="flex gap-2">
                    <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <button onClick={() => pinInput && sendCmd(`DATA DELETE USERINFO PIN=${pinInput}`, 'usuarios')}
                      disabled={sending || !pinInput}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Borrar</button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-2">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Sincronizar desde Sistema</p>
                  <p className="text-[10px] text-gray-400">Envía TODOS los empleados activos al dispositivo</p>
                  <button onClick={async () => {
                    if (!empresaId) return;
                    for (const emp of empleados.filter(e => e.zkteco_user_id && e.activo !== false)) {
                      const name = `${emp.primer_nombre} ${emp.primer_apellido}`.trim();
                      await sendCmd(`DATA UPDATE USERINFO PIN=${emp.zkteco_user_id}\tName=${name}\tPri=0\tPass=\tCard=\tGrp=1`, 'usuarios');
                    }
                  }} disabled={sending}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Sincronizar Plantilla Completa</button>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-2">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Borrar Todos los Usuarios</p>
                  <button onClick={() => sendCmd('CLEAR USERINFO', 'usuarios')}
                    disabled={sending}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">CLEAR USERINFO</button>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-2">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Solicitar Usuarios del Dispositivo</p>
                  <button onClick={() => sendCmd('CMD USERINFO', 'usuarios')}
                    disabled={sending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">CMD USERINFO</button>
                </div>
              </div>
            </div>
          )}

          {activeCat === 'huellas' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Huellas Digitales y Reconocimiento Facial</h4>
              <p className="text-xs text-gray-500">Envía comandos de registro/borrado de templates biométricos al dispositivo.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Enviar Huella (FINGERTMP)</p>
                  <div className="flex gap-2">
                    <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <input value={fingerInput} onChange={e => setFingerInput(e.target.value)} placeholder="Finger# (0-9)" className="w-28 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                  </div>
                  <p className="text-[10px] text-gray-400">Para registrar, pon el dedo en el dispositivo cuando reciba el comando.</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Borrar Huella</p>
                  <div className="flex gap-2">
                    <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <input value={fingerInput} onChange={e => setFingerInput(e.target.value)} placeholder="Finger# (0-9)" className="w-28 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <button onClick={() => pinInput && sendCmd(`DATA DELETE FINGERTMP PIN=${pinInput} FINGER=${fingerInput || '0'}`, 'huellas')}
                      disabled={sending || !pinInput}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Borrar</button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Enviar Rostro (FACETMP)</p>
                  <div className="flex gap-2">
                    <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <button onClick={() => pinInput && sendCmd(`DATA UPDATE FACETMP PIN=${pinInput}`, 'huellas')}
                      disabled={sending || !pinInput}
                      className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Enviar Rostro</button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Borrar Rostro (FACETMP)</p>
                  <div className="flex gap-2">
                    <input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <button onClick={() => pinInput && sendCmd(`DATA DELETE FACETMP PIN=${pinInput}`, 'huellas')}
                      disabled={sending || !pinInput}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Borrar Rostro</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCat === 'logs' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Checadas y Bitácoras del Dispositivo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Solicitar Checadas por Rango</p>
                  <div className="flex gap-2">
                    <input type="date" value={logStart} onChange={e => setLogStart(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <input type="date" value={logEnd} onChange={e => setLogEnd(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const start = logStart ? `StartTime=${logStart} 00:00:00` : '';
                      const end = logEnd ? `EndTime=${logEnd} 23:59:59` : '';
                      sendCmd(`CMD ATTLOG ${start} ${end}`.trim(), 'logs');
                    }} disabled={sending}
                      className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">CMD ATTLOG</button>
                    <button onClick={() => sendCmd(`CMD OPERLOG`, 'logs')}
                      disabled={sending}
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">CMD OPERLOG</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <button onClick={() => sendCmd('CLEAR ATTLOG', 'logs')}
                    disabled={sending}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all text-xs font-semibold">
                    <Trash2 size={20} className="text-rose-500" />
                    <div className="text-left"><p className="text-gray-900 dark:text-white">Limpiar Checadas</p><p className="text-[10px] text-gray-400">CLEAR ATTLOG</p></div>
                  </button>
                  <button onClick={() => sendCmd('CLEAR DATA', 'logs')}
                    disabled={sending}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all text-xs font-semibold">
                    <Database size={20} className="text-rose-600" />
                    <div className="text-left"><p className="text-gray-900 dark:text-white">Limpiar Todos los Datos</p><p className="text-[10px] text-gray-400">CLEAR DATA</p></div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeCat === 'config' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Configuración del Dispositivo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Red</p>
                  <div className="space-y-2">
                    <div className="flex gap-2"><span className="text-[10px] text-gray-400 w-16">IP:</span>
                      <input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="192.168.1.100" className="flex-1 px-2 py-1.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" /></div>
                    <div className="flex gap-2"><span className="text-[10px] text-gray-400 w-16">Máscara:</span>
                      <input value={maskInput} onChange={e => setMaskInput(e.target.value)} placeholder="255.255.255.0" className="flex-1 px-2 py-1.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" /></div>
                    <div className="flex gap-2"><span className="text-[10px] text-gray-400 w-16">Gateway:</span>
                      <input value={gatewayInput} onChange={e => setGatewayInput(e.target.value)} placeholder="192.168.1.1" className="flex-1 px-2 py-1.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" /></div>
                    <button onClick={() => sendCmd(`SET OPTIONS IPAddr=${ipInput},NetMask=${maskInput},Gateway=${gatewayInput}`, 'config')}
                      disabled={sending || !ipInput}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Aplicar Config. Red</button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Servidor / Puerto</p>
                  <div className="flex gap-2"><span className="text-[10px] text-gray-400 w-16">Puerto:</span>
                    <input value={portInput} onChange={e => setPortInput(e.target.value)} placeholder="4370" className="flex-1 px-2 py-1.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" /></div>
                  <button onClick={() => sendCmd(`SET OPTIONS Port=${portInput}`, 'config')}
                    disabled={sending}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">Aplicar Puerto</button>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Configuración General</p>
                  <div className="flex gap-2">
                    <button onClick={() => sendCmd('SET OPTIONS DHCP=ON', 'config')}
                      disabled={sending} className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold rounded-lg">DHCP ON</button>
                    <button onClick={() => sendCmd('SET OPTIONS DHCP=OFF', 'config')}
                      disabled={sending} className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold rounded-lg">DHCP OFF</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendCmd('SET OPTIONS Beep=1', 'config')}
                      disabled={sending} className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold rounded-lg"><Bell size={12} className="inline mr-1" />Sonido ON</button>
                    <button onClick={() => sendCmd('SET OPTIONS Beep=0', 'config')}
                      disabled={sending} className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold rounded-lg"><Bell size={12} className="inline mr-1" />Sonido OFF</button>
                  </div>
                  <button onClick={() => sendCmd('SET OPTIONS TimeZone=-6', 'config')}
                    disabled={sending}
                    className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold rounded-lg mb-2">Zona Horaria UTC-6</button>
                  <button onClick={() => sendCmd('SET OPTIONS AutoSwitchState=0,State=0', 'config')}
                    disabled={sending}
                    className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors">
                    Desactivar Auto-Switch de Estado
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Festivos (HOLIDAY)</p>
                  <div className="flex gap-2">
                    <input type="date" id="holidayDate" className="flex-1 px-2 py-1.5 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs" />
                    <button onClick={() => {
                      const el = document.getElementById('holidayDate') as HTMLInputElement;
                      if (el.value) sendCmd(`DATA UPDATE HOLIDAY Date=${el.value}`, 'config');
                    }} disabled={sending}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg">Agregar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCat === 'sistema' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Comandos del Sistema</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => sendCmd('CMD REBOOT', 'sistema')}
                  disabled={sending}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all text-xs font-semibold">
                  <Power size={28} className="text-amber-500" />
                  <p className="text-gray-900 dark:text-white">REBOOT</p>
                  <p className="text-[10px] text-gray-400">Reiniciar dispositivo</p>
                </button>
                <button onClick={() => sendCmd('CMD FACTORYDEFAULT', 'sistema')}
                  disabled={sending}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all text-xs font-semibold">
                  <AlertTriangle size={28} className="text-rose-500" />
                  <p className="text-gray-900 dark:text-white">FACTORY DEFAULT</p>
                  <p className="text-[10px] text-gray-400">Restaurar fábrica</p>
                </button>
                <button onClick={() => sendCmd('CLEAR ADMIN', 'sistema')}
                  disabled={sending}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all text-xs font-semibold">
                  <HardDrive size={28} className="text-orange-500" />
                  <p className="text-gray-900 dark:text-white">CLEAR ADMIN</p>
                  <p className="text-[10px] text-gray-400">Limpiar admins</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Command History */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
            <History className="text-amber-500" size={16} /> Historial de Comandos
          </h4>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {history.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No hay comandos enviados aún</p>}
            {history.map((h, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${h.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {h.ok ? <CheckCircle size={12} className="inline mr-1" /> : <XCircle size={12} className="inline mr-1" />}
                    {h.id}
                  </span>
                  <span className="text-[9px] text-gray-400">{new Date(h.timestamp).toLocaleString()}</span>
                </div>
                <p className="font-mono text-[9px] text-gray-500 truncate">{h.comando}</p>
                <p className={`text-[9px] ${h.ok ? 'text-emerald-500' : 'text-gray-400'}`}>Resultado: {h.resultado}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
