'use client';

import { useState } from 'react';
import { Users, FileText, CheckCircle } from 'lucide-react';
import type { EmpleadoDetalle, Puesto, StaffMember, Departamento } from '../types';
import { saveEmpleado, deleteEmpleado } from '../actions';
import HorarioIndividualModal from './HorarioIndividualModal';

interface Props {
  empleados: EmpleadoDetalle[];
  puestos: Puesto[];
  staffList: StaffMember[];
  departamentos: Departamento[];
  horariosEmpleados: any[];
  turnos: any[];
  empresaId: string | null;
  onSaved: () => void;
}

export default function EmpleadosTab({ empleados, puestos, staffList, departamentos, horariosEmpleados, turnos, empresaId, onSaved }: Props) {
  const [selected, setSelected] = useState<EmpleadoDetalle | null>(null);
  const [scheduleEmp, setScheduleEmp] = useState<EmpleadoDetalle | null>(null);
  const [form, setForm] = useState({
    usuario_staff_id: '', primer_apellido: '', segundo_apellido: '', primer_nombre: '', segundo_nombre: '',
    curp: '', rfc: '', nss: '', telefono: '', banco: '', cuenta_clabe: '',
    sueldo_diario: 250, salario_diario_integrado: 260, zkteco_user_id: '',
    tipo_contrato: 'indeterminado', fecha_ingreso: new Date().toISOString().split('T')[0], puesto_id: ''
  });

  const resetForm = () => {
    setSelected(null);
    setForm({
      usuario_staff_id: '', primer_apellido: '', segundo_apellido: '', primer_nombre: '', segundo_nombre: '',
      curp: '', rfc: '', nss: '', telefono: '', banco: '', cuenta_clabe: '',
      sueldo_diario: 250, salario_diario_integrado: 260, zkteco_user_id: '',
      tipo_contrato: 'indeterminado', fecha_ingreso: new Date().toISOString().split('T')[0], puesto_id: ''
    });
  };

  const handleEdit = (emp: EmpleadoDetalle) => {
    setSelected(emp);
    setForm({
      usuario_staff_id: emp.usuario_staff_id || '',
      primer_apellido: emp.primer_apellido || '', segundo_apellido: emp.segundo_apellido || '',
      primer_nombre: emp.primer_nombre || '', segundo_nombre: emp.segundo_nombre || '',
      curp: emp.curp || '', rfc: emp.rfc || '', nss: emp.nss || '',
      telefono: emp.telefono || '', banco: emp.banco || '', cuenta_clabe: emp.cuenta_clabe || '',
      sueldo_diario: emp.sueldo_diario || 250, salario_diario_integrado: emp.salario_diario_integrado || 260,
      zkteco_user_id: emp.zkteco_user_id || '',
      tipo_contrato: emp.tipo_contrato || 'indeterminado',
      fecha_ingreso: emp.fecha_ingreso || new Date().toISOString().split('T')[0],
      puesto_id: emp.puesto_id || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.primer_apellido || !form.primer_nombre || !empresaId) return;
    try {
      const payload: any = {
        empresa_id: empresaId, usuario_staff_id: form.usuario_staff_id || null,
        primer_apellido: form.primer_apellido, segundo_apellido: form.segundo_apellido || null,
        primer_nombre: form.primer_nombre, segundo_nombre: form.segundo_nombre || null,
        curp: form.curp || null, rfc: form.rfc || null, nss: form.nss || null,
        telefono: form.telefono || null, banco: form.banco || null, cuenta_clabe: form.cuenta_clabe || null,
        sueldo_diario: form.sueldo_diario, salario_diario_integrado: form.salario_diario_integrado,
        zkteco_user_id: form.zkteco_user_id || null, tipo_contrato: form.tipo_contrato,
        fecha_ingreso: form.fecha_ingreso, puesto_id: form.puesto_id || null, activo: true
      };
      await saveEmpleado(payload, !!selected, selected?.id);
      resetForm();
      onSaved();
    } catch (err: any) {
      alert('Error al guardar empleado: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este empleado?')) return;
    try {
      await deleteEmpleado(id);
      onSaved();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const getPuestoNombre = (puestoId: string) => puestos.find(p => p.id === puestoId)?.nombre || 'Sin Puesto';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
          <FileText className="text-amber-500" size={18} /> {selected ? 'Modificar Empleado' : 'Nuevo Expediente'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Primer Apellido *</label>
              <input type="text" required value={form.primer_apellido} onChange={e => setForm({ ...form, primer_apellido: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Segundo Apellido</label>
              <input type="text" value={form.segundo_apellido} onChange={e => setForm({ ...form, segundo_apellido: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Primer Nombre *</label>
              <input type="text" required value={form.primer_nombre} onChange={e => setForm({ ...form, primer_nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Segundo Nombre</label>
              <input type="text" value={form.segundo_nombre} onChange={e => setForm({ ...form, segundo_nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Puesto *</label>
              <select value={form.puesto_id} onChange={e => setForm({ ...form, puesto_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="">Seleccionar...</option>
                {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ID Biométrico (PIN) *</label>
              <input type="text" required value={form.zkteco_user_id} onChange={e => setForm({ ...form, zkteco_user_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sueldo Diario ($)</label>
              <input type="number" value={form.sueldo_diario} onChange={e => setForm({ ...form, sueldo_diario: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SDI</label>
              <input type="number" value={form.salario_diario_integrado} onChange={e => setForm({ ...form, salario_diario_integrado: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">RFC</label>
              <input type="text" maxLength={13} value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CURP</label>
              <input type="text" maxLength={18} value={form.curp} onChange={e => setForm({ ...form, curp: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">NSS</label>
              <input type="text" maxLength={11} value={form.nss} onChange={e => setForm({ ...form, nss: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Teléfono</label>
              <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Banco</label>
              <input type="text" value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CLABE</label>
              <input type="text" maxLength={18} value={form.cuenta_clabe} onChange={e => setForm({ ...form, cuenta_clabe: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
          </div>
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Usuario Staff</label>
            <select value={form.usuario_staff_id} onChange={e => setForm({ ...form, usuario_staff_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500">
              <option value="">Ninguno</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.correo}</option>)}
            </select></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors">Guardar</button>
            {selected && <button type="button" onClick={resetForm} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-bold">Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
          <Users className="text-amber-500" size={18} /> Plantilla de Empleados
        </h3>
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                <th className="p-3">Nombre</th>
                <th className="p-3">Puesto</th>
                <th className="p-3">PIN</th>
                <th className="p-3">Sueldo</th>
                <th className="p-3">Depto</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
              {empleados.filter(e => e.activo !== false).map(emp => {
                const puesto = puestos.find(p => p.id === emp.puesto_id);
                const depto = departamentos.find(d => d.id === puesto?.departamento_id);
                return (
                  <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                    <td className="p-3 font-semibold text-gray-900 dark:text-white">{emp.nombre_completo}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{puesto?.nombre || 'Sin Puesto'}</td>
                    <td className="p-3 font-mono text-gray-500">{emp.zkteco_user_id || 'N/A'}</td>
                    <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">${emp.sueldo_diario}</td>
                    <td className="p-3 text-gray-400 text-[10px]">{depto?.nombre || '-'}</td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => handleEdit(emp)} className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded font-semibold text-[10px] transition-colors">Editar</button>
                      <button onClick={() => setScheduleEmp(emp)} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded font-semibold text-[10px] transition-colors">Horario</button>
                      <button onClick={() => handleDelete(emp.id)} className="px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded font-semibold text-[10px] transition-colors">Baja</button>
                    </td>
                  </tr>
                );
              })}
              {empleados.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400 italic">No hay empleados registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {scheduleEmp && (
        <HorarioIndividualModal
          empleado={scheduleEmp}
          horariosEmpleados={horariosEmpleados}
          turnos={turnos}
          onClose={() => setScheduleEmp(null)}
          onSaved={() => { setScheduleEmp(null); onSaved(); }}
        />
      )}
    </div>
  );
}
