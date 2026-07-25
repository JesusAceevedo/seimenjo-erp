'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsistencia } from './_hooks/useAsistencia';
import DashboardTab from './_components/DashboardTab';
import EmpleadosTab from './_components/EmpleadosTab';
import TurnosTab from './_components/TurnosTab';
import IncidenciasTab from './_components/IncidenciasTab';
import NominaTab from './_components/NominaTab';
import RelojTab from './_components/RelojTab';
import CalendarioDescansos from './_components/CalendarioDescansos';
import ComplianceTab from './_components/ComplianceTab';
import type { TabId } from './types';

import {
  Clock, Users, Calendar, AlertCircle, DollarSign, Monitor, Sun, Shield
} from 'lucide-react';

export default function AsistenciaNominasPage() {
  const {
    empresaId, loading, activeTab, setActiveTab,
    departamentos, puestos, staffList, empleados, turnos,
    checadasRaw, incidencias, horariosEmpleados,
    presenciaHoy, dashboardStartDate, dashboardEndDate,
    setDashboardStartDate, setDashboardEndDate,
    dashboardStats, loadData
  } = useAsistencia();

  const [syncingTime, setSyncingTime] = useState(false);

  const handleSyncTime = async () => {
    if (!empresaId) return;
    setSyncingTime(true);
    try {
      const sns = Array.from(new Set(checadasRaw.map(c => c.dispositivo_sn).filter(Boolean)));
      const now = new Date();
      const unixTimestamp = Math.floor(now.getTime() / 1000);
      const timezoneOffsetMinutes = now.getTimezoneOffset();
      const offsetSign = timezoneOffsetMinutes > 0 ? '-' : '+';
      const absOffsetMinutes = Math.abs(timezoneOffsetMinutes);
      const offsetHours = Math.floor(absOffsetMinutes / 60).toString().padStart(2, '0');
      const offsetMins = (absOffsetMinutes % 60).toString().padStart(2, '0');
      const serverTZ = `${offsetSign}${offsetHours}${offsetMins}`;
      const targets = sns.length > 0 ? sns : [null];

      for (const sn of targets) {
        const cmdId = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('zkteco_comandos').insert({
          empresa_id: empresaId,
          dispositivo_sn: sn,
          comando_id: cmdId,
          comando_texto: `SET OPTIONS DateTime=${unixTimestamp},ServerTZ=${serverTZ}`,
          categoria: 'comunicacion',
          procesado: false
        });
      }
      alert(`Sincronización programada (${serverTZ}) para ${sns.length > 0 ? `${sns.length} dispositivo(s)` : 'todos'}.`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSyncingTime(false);
    }
  };

  const tabs = [
    { id: 'monitoreo' as const, label: 'Dashboard', icon: Monitor },
    { id: 'nomina' as const, label: 'Nómina y Propinas', icon: DollarSign },
    { id: 'empleados' as const, label: 'Expediente', icon: Users },
    { id: 'turnos' as const, label: 'Horarios', icon: Calendar },
    { id: 'incidencias' as const, label: 'Incidencias LFT', icon: AlertCircle },
    { id: 'descansos' as const, label: 'Descansos', icon: Sun },
    { id: 'reloj' as const, label: 'Reloj ADMS', icon: Clock },
    { id: 'compliance' as const, label: 'Cumplimiento LFT', icon: Shield },
  ];



  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 font-sans p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="text-amber-500" /> Control de Asistencia y Nómina
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            ZKTeco ADMS · Restaurant HR · LFT Compliance
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-px">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs tracking-wider uppercase transition-all whitespace-nowrap ${
                active ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando datos...</div>
        ) : (
          <>
            {activeTab === 'monitoreo' && (
              <DashboardTab
                dashboardStats={dashboardStats}
                dashboardStartDate={dashboardStartDate}
                dashboardEndDate={dashboardEndDate}
                onStartDateChange={setDashboardStartDate}
                onEndDateChange={setDashboardEndDate}
                empleados={empleados}
                puestos={puestos}
                departamentos={departamentos}
                horariosEmpleados={horariosEmpleados}
                turnos={turnos}
                checadasRaw={checadasRaw}
                presenciaHoy={presenciaHoy}
                onSyncTime={handleSyncTime}
                syncingTime={syncingTime}
                onSaved={loadData}
              />
            )}
            {activeTab === 'empleados' && (
              <EmpleadosTab
                empleados={empleados}
                puestos={puestos}
                staffList={staffList}
                departamentos={departamentos}
                horariosEmpleados={horariosEmpleados}
                turnos={turnos}
                empresaId={empresaId}
                onSaved={loadData}
              />
            )}
            {activeTab === 'turnos' && (
              <TurnosTab
                turnos={turnos}
                empleados={empleados}
                empresaId={empresaId}
                onSaved={loadData}
              />
            )}
            {activeTab === 'incidencias' && (
              <IncidenciasTab
                incidencias={incidencias}
                empleados={empleados}
                empresaId={empresaId}
                onSaved={loadData}
              />
            )}
            {activeTab === 'nomina' && (
              <NominaTab
                empleados={empleados}
                puestos={puestos}
                checadasRaw={checadasRaw}
                empresaId={empresaId}
                turnos={turnos}
                horariosEmpleados={horariosEmpleados}
                incidencias={incidencias}
              />
            )}
            {activeTab === 'descansos' && (
              <CalendarioDescansos
                empresaId={empresaId}
                empleados={empleados}
                departamentos={departamentos}
                puestos={puestos}
              />
            )}
            {activeTab === 'reloj' && (
              <RelojTab
                empresaId={empresaId}
                empleados={empleados}
                checadasRaw={checadasRaw}
                onSyncTime={handleSyncTime}
                syncingTime={syncingTime}
              />
            )}
            {activeTab === 'compliance' && (
              <ComplianceTab
                empresaId={empresaId}
                empleados={empleados}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
