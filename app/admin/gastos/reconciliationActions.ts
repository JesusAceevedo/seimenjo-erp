'use server';

import { supabaseAdmin, getUserEmpresaId } from '../../../lib/supabaseAdmin';
import { XMLParser } from 'fast-xml-parser';

function parseNumberClean(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Helper to extract RFC from bank description (SAT CFDI RFC Regex)
function extraerRfcDeConcepto(concepto: string): string | null {
  if (!concepto) return null;
  const regex = /RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i;
  const match = concepto.match(regex);
  return match ? match[1].toUpperCase() : null;
}

const BASIC_STATUSES = [
  {
    clave: 'pendiente',
    nombre: 'Pendiente de Conciliar',
    descripcion: 'El movimiento no ha sido verificado o conciliado',
    color: '#9CA3AF',
    empresa_id: null
  },
  {
    clave: 'comprobado',
    nombre: 'Comprobado',
    descripcion: 'Completamente comprobado con XML de factura y/o ticket',
    color: '#10B981',
    empresa_id: null
  },
  {
    clave: 'incompleto',
    nombre: 'Incompleto',
    descripcion: 'Le hace falta algún documento como XML, PDF de Factura o Ticket',
    color: '#F59E0B',
    empresa_id: null
  },
  {
    clave: 'incompleto_comprobado',
    nombre: 'Incompleto y Comprobado',
    descripcion: 'Aparece en el banco y está comprobado, pero le falta algún archivo/documento',
    color: '#3B82F6',
    empresa_id: null
  },
  {
    clave: 'no_deducible',
    nombre: 'Movimiento no Deducible',
    descripcion: 'Falta la factura o no está comprobado en el estado de cuenta (excepto efectivo)',
    color: '#EF4444',
    empresa_id: null
  },
  {
    clave: 'no_facturable',
    nombre: 'Movimiento no Facturable',
    descripcion: 'Comisiones, impuestos, nóminas u otros que no requieren factura deducible',
    color: '#8B5CF6',
    empresa_id: null
  },
  {
    clave: 'no_detectado',
    nombre: 'Movimiento no detectado',
    descripcion: 'El importe no coincide con ningún registro del sistema o la fecha es posterior a la factura.',
    color: '#EF4444',
    empresa_id: null
  },
  {
    clave: 'conciliado',
    nombre: 'Conciliado',
    descripcion: 'El movimiento coincide con el banco y está conciliado',
    color: '#10B981',
    empresa_id: null
  }
];

export async function ensureBasicStatuses(): Promise<void> {
  try {
    const { data: current, error } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('clave');
    if (error) throw error;

    const existingClaves = new Set(current?.map(c => (c.clave || '').toLowerCase()) || []);
    const toInsert = BASIC_STATUSES.filter(s => !existingClaves.has(s.clave));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('estatus_conciliacion_bancaria')
        .insert(toInsert);
      if (insertError) {
        console.error('Error auto-healing basic statuses:', insertError);
      }
    }
  } catch (err) {
    console.error('Failed to ensure basic statuses:', err);
  }
}

// Helper to check if concept indicates a Cash transaction
function esMovimientoEfectivo(concepto: string): boolean {
  if (!concepto) return false;
  const c = concepto.toUpperCase();
  return (
    c.includes('EFECTIVO') ||
    c.includes('CAJERO') ||
    c.includes('RETIRO CAJERO') ||
    c.includes('DEPOSITO CAJERO') ||
    c.includes('PRACTICAJA') ||
    c.includes('DISP.') ||
    c.includes('DISPOSICIÓN') ||
    c.includes('DISPOSICION')
  );
}

function obtenerMetodoPagoBanco(concepto: string): '01' | '03' | '04_28' | 'unknown' {
  if (!concepto) return 'unknown';
  const c = concepto.toUpperCase();
  if (c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO')) {
    return '01'; // Efectivo
  }
  if (c.includes('SPEI') || c.includes('TRANSFERENCIA') || c.includes('TRF') || c.includes('TRANSF') || c.includes('TEF') || c.includes('TRASPASO')) {
    return '03'; // Transferencia
  }
  if (c.includes('TARJETA') || c.includes('PAGO CON TARJETA') || c.includes('TDC') || c.includes('T.DEB') || c.includes('T.CRE') || c.includes('DEBITO') || c.includes('CREDITO')) {
    return '04_28'; // Tarjeta
  }
  return 'unknown';
}

function detectarDiscrepanciaPago(conceptoBanco: string, metodoPagoGasto: string | null | undefined): { tieneDiscrepancia: boolean; detalle?: string } {
  if (!metodoPagoGasto) return { tieneDiscrepancia: false };
  const mpBanco = obtenerMetodoPagoBanco(conceptoBanco);
  if (mpBanco === 'unknown') return { tieneDiscrepancia: false };

  const cleanGastoCode = metodoPagoGasto.trim().padStart(2, '0');

  // Si el banco indica Efectivo (01) pero el gasto indica otra cosa (transferencia o tarjeta)
  if (mpBanco === '01' && cleanGastoCode !== '01') {
    return { tieneDiscrepancia: true, detalle: 'El banco indica retiro en efectivo pero el comprobante indica pago electrónico.' };
  }
  // Si el banco indica Transferencia (03) pero el gasto indica otra cosa
  if (mpBanco === '03' && cleanGastoCode !== '03') {
    return { tieneDiscrepancia: true, detalle: 'El banco indica transferencia pero el comprobante indica tarjeta/efectivo.' };
  }
  // Si el banco indica Tarjeta pero el gasto indica otra cosa (no es 04 ni 28)
  if (mpBanco === '04_28' && cleanGastoCode !== '04' && cleanGastoCode !== '28') {
    return { tieneDiscrepancia: true, detalle: 'El banco indica tarjeta pero el comprobante indica transferencia/efectivo.' };
  }

  return { tieneDiscrepancia: false };
}

function parseFechaClean(rawFecha: any, concepto?: string): string {
  let str = rawFecha !== undefined && rawFecha !== null ? String(rawFecha).trim() : '';

  // 1. Parsear primero la fecha explícita recibida del Excel (Columna de fecha)
  if (str && str !== 'undefined' && str !== 'null') {
    // 1a. Si es serial de Excel (ej: 45498 o 45498.5)
    if (/^\d{4,5}(\.\d+)?$/.test(str)) {
      const serial = parseFloat(str);
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        if (yyyy >= 2020 && yyyy <= 2040) {
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    const dateOnly = str.split('T')[0].split(' ')[0].trim();

    // 1b. Si contiene '-' (ej: 2026-07-29 o 29-07-2026 o 29-07-26)
    if (dateOnly.includes('-')) {
      const parts = dateOnly.split('-');
      if (parts[0] && parts[0].length === 4) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        const yNum = parseInt(yyyy, 10);
        if (yNum >= 2020 && yNum <= 2040) {
          return `${yyyy}-${mm}-${dd}`;
        }
      } else if (parts[2] && parts[2].trim().length >= 2) {
        const yr = parts[2].trim().substring(0, 4);
        const yyyy = yr.length === 2 ? `20${yr}` : yr;
        const mm = parts[1].padStart(2, '0');
        const dd = parts[0].padStart(2, '0');
        const yNum = parseInt(yyyy, 10);
        if (yNum >= 2020 && yNum <= 2040) {
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    // 1c. Si contiene '/' (ej: 29/07/2026 o 29/07/26 o 2026/07/29)
    if (dateOnly.includes('/')) {
      const parts = dateOnly.split('/');
      if (parts[0] && parts[0].length === 4) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        const yNum = parseInt(yyyy, 10);
        if (yNum >= 2020 && yNum <= 2040) {
          return `${yyyy}-${mm}-${dd}`;
        }
      } else if (parts[2] && parts[2].trim().length >= 2) {
        const yr = parts[2].trim().substring(0, 4);
        const yyyy = yr.length === 2 ? `20${yr}` : yr;
        const mm = parts[1].padStart(2, '0');
        const dd = parts[0].padStart(2, '0');
        const yNum = parseInt(yyyy, 10);
        if (yNum >= 2020 && yNum <= 2040) {
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    // 1d. Intentar Date.parse normal
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      if (yyyy >= 2020 && yyyy <= 2040) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  // 2. SOLO SI la fecha de la columna no vino o fue inválida: intentar extraerla del concepto
  if (concepto) {
    // 2a. Fecha embebida estilo estado de cuenta BBVA ("09/JUL", "09 JUL", "09-JUL") — más confiable
    const MESES: Record<string, number> = {
      ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
      JAN: 1, APR: 4, AUG: 8, DEC: 12
    };
    const mesMatch = concepto.match(/\b(\d{1,2})\s*[\/\-\.]\s*([A-Za-z]{3})(?:\b|[^A-Za-z])/);
    if (mesMatch) {
      const dNum = parseInt(mesMatch[1], 10);
      const mNum = MESES[mesMatch[2].toUpperCase()];
      if (mNum && dNum >= 1 && dNum <= 31) {
        const now = new Date();
        let yyyy = now.getFullYear();
        if (mNum > now.getMonth() + 1) yyyy -= 1;
        return `${yyyy}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      }
    }

    // 2b. Referencia SPEI (DDMMYY embebido en 8 dígitos consecutivos)
    const speiMatch = concepto.match(/\b(\d{2})(\d{2})(\d{2})\d(?=[A-Za-z0-9]|$)/);
    if (speiMatch) {
      const dd = speiMatch[1];
      const mm = speiMatch[2];
      const yy = speiMatch[3];
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        return `20${yy}-${mm}-${dd}`;
      }
    }
  }

  return new Date().toISOString().substring(0, 10);
}

// 1. IMPORTAR MOVIMIENTOS BANCARIOS DESDE EXCEL / CSV
export async function importarMovimientosBancarios(
  movements: {
    fecha: string;
    concepto: string;
    retiro?: number | string;
    deposito?: number | string;
    referencia?: string;
  }[],
  token: string,
  cuentaBancariaId?: string,
  nombreArchivo: string = 'Estado_de_cuenta.xlsx',
  cargaIdToReplace?: string
): Promise<{ success: boolean; count?: number; cargaId?: string; error?: string }> {
  try {
    await ensureBasicStatuses();
    const { empresaId } = await getUserEmpresaId(token);

    // Get Pendiente status ID
    const { data: statusPendiente } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'pendiente')
      .single();

    const estatusId = statusPendiente?.id;

    // Obtener cuentas bancarias para el auto-enrutamiento (solo de la empresa activa)
    const { data: cuentas } = await supabaseAdmin
      .from('cuentas_bancarias')
      .select('id, nombre')
      .eq('empresa_id', empresaId);

    const bbvaAcc = cuentas?.find(c => c.nombre.toUpperCase() === 'BBVA');
    const cajaAcc = cuentas?.find(c => c.nombre.toUpperCase().includes('CAJA CHICA'));
    const parrotAcc = cuentas?.find(c => c.nombre.toUpperCase() === 'PARROT');

    const bbvaId = bbvaAcc?.id;
    const cajaId = cajaAcc?.id;
    const parrotId = parrotAcc?.id;

    const formattedMovements = movements.map((m) => {
      let r = Math.abs(parseNumberClean(m.retiro));
      let d = Math.abs(parseNumberClean(m.deposito));
      const rfc = extraerRfcDeConcepto(m.concepto);

      // Enrutamiento automático: solo si el usuario NO eligió una cuenta destino explícita
      const conceptoUpper = (m.concepto || '').toUpperCase();
      let targetCuentaId = cuentaBancariaId || null;

      if (!targetCuentaId) {
        if (conceptoUpper.includes('OELTRANSFER')) {
          targetCuentaId = parrotId;
        } else if (esMovimientoEfectivo(m.concepto || '')) {
          targetCuentaId = cajaId;
        } else {
          targetCuentaId = bbvaId;
        }
      }

      // Si se enruta a la Caja Chica y era un Retiro (salida del banco), lo sumamos en la Caja Chica (se convierte a Depósito)
      if (targetCuentaId === cajaId && r > 0 && d === 0) {
        d = r;
        r = 0;
      }

      const montoVal = d - r;
      const tipo = d > 0 ? 'Deposito' : 'Retiro';
      const fechaFormatted = parseFechaClean(m.fecha, m.concepto);

      return {
        fecha: fechaFormatted,
        concepto: m.concepto,
        retiro: r,
        deposito: d,
        monto: montoVal,
        tipo_movimiento: tipo,
        referencia: m.referencia || null,
        estatus_conciliacion_id: estatusId,
        rfc_proveedor: rfc,
        empresa_id: empresaId,
        cuenta_bancaria_id: targetCuentaId,
        mes_conciliacion: fechaFormatted.substring(0, 7),
        visible_egresos: false,
        visible_ingresos: false
      };
    });

    // Registrar o actualizar la carga_id usando la fecha real del documento
    let totalDepositos = 0;
    let totalRetiros = 0;
    formattedMovements.forEach(m => {
      if (m.deposito > 0) totalDepositos += m.deposito;
      if (m.retiro > 0) totalRetiros += m.retiro;
    });

    const fechesSorted = formattedMovements
      .map(m => m.fecha)
      .filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f))
      .sort();

    const minFecha = fechesSorted[0] || new Date().toISOString().substring(0, 10);
    const maxFecha = fechesSorted[fechesSorted.length - 1] || minFecha;
    const fechaDocumentoStr = minFecha === maxFecha ? minFecha : `${minFecha} al ${maxFecha}`;

    let currentCargaId = cargaIdToReplace || null;

    if (cargaIdToReplace) {
      // Eliminar registros anteriores de la carga si estamos sustituyendo
      const { data: oldMovs } = await supabaseAdmin
        .from('movimientos_bancarios')
        .select('id')
        .eq('carga_id', cargaIdToReplace)
        .eq('empresa_id', empresaId);

      const oldIds = (oldMovs || []).map(m => m.id);
      if (oldIds.length > 0) {
        await supabaseAdmin.from('conciliaciones_bancarias').delete().in('movimiento_id', oldIds);
        await supabaseAdmin.from('gastos').update({ movimiento_bancario_id: null }).in('movimiento_bancario_id', oldIds);
        await supabaseAdmin.from('pedidos').update({ movimiento_bancario_id: null }).in('movimiento_bancario_id', oldIds);
        await supabaseAdmin.from('movimientos_bancarios').delete().in('id', oldIds);
      }

      await supabaseAdmin
        .from('cargas_estados_cuenta')
        .update({
          nombre_archivo: nombreArchivo,
          fecha_carga: minFecha,
          cuenta_bancaria_id: cuentaBancariaId || null,
          total_registros: formattedMovements.length,
          total_depositos: totalDepositos,
          total_retiros: totalRetiros,
          notas: `Fecha del documento: ${fechaDocumentoStr}`
        })
        .eq('id', cargaIdToReplace);
    } else {
      const { data: newCarga } = await supabaseAdmin
        .from('cargas_estados_cuenta')
        .insert({
          nombre_archivo: nombreArchivo,
          fecha_carga: minFecha,
          cuenta_bancaria_id: cuentaBancariaId || null,
          empresa_id: empresaId,
          total_registros: formattedMovements.length,
          total_depositos: totalDepositos,
          total_retiros: totalRetiros,
          notas: `Fecha del documento: ${fechaDocumentoStr}`
        })
        .select('id')
        .maybeSingle();

      if (newCarga) {
        currentCargaId = newCarga.id;
      }
    }

    // Check for duplicates in the DB globally for this company (across all accounts)
    const { data: existingMovements, error: fetchErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('fecha, concepto, monto, referencia, cuenta_bancaria_id')
      .eq('empresa_id', empresaId);
    if (fetchErr) throw fetchErr;

    const makeKey = (item: {
      fecha: string;
      concepto: string;
      monto: number;
      referencia?: string | null;
      cuenta_bancaria_id?: string | null;
    }) => {
      const dateStr = item.fecha ? item.fecha.substring(0, 10) : '';
      const conceptStr = (item.concepto || '').trim().toLowerCase();
      const amountVal = Number(item.monto || 0).toFixed(2);
      const refStr = (item.referencia || '').trim().toLowerCase();
      const accId = item.cuenta_bancaria_id || '';
      return `${dateStr}|${conceptStr}|${amountVal}|${refStr}|${accId}`;
    };

    // Count key occurrences in database
    const dbKeyCounts: Record<string, number> = {};
    existingMovements?.forEach((m) => {
      const key = makeKey({
        fecha: m.fecha,
        concepto: m.concepto,
        monto: m.monto,
        referencia: m.referencia,
        cuenta_bancaria_id: m.cuenta_bancaria_id,
      });
      dbKeyCounts[key] = (dbKeyCounts[key] || 0) + 1;
    });

    // Count key occurrences in the current import batch
    const fileKeyCounts: Record<string, number> = {};
    formattedMovements.forEach((m) => {
      const key = makeKey({
        fecha: m.fecha,
        concepto: m.concepto,
        monto: m.monto,
        referencia: m.referencia,
        cuenta_bancaria_id: m.cuenta_bancaria_id,
      });
      fileKeyCounts[key] = (fileKeyCounts[key] || 0) + 1;
    });

    // Filter to only new movements (matching based on occurrence counts)
    const addedKeyCounts: Record<string, number> = {};
    const newMovements = formattedMovements
      .filter((m) => {
        const key = makeKey({
          fecha: m.fecha,
          concepto: m.concepto,
          monto: m.monto,
          referencia: m.referencia,
          cuenta_bancaria_id: m.cuenta_bancaria_id,
        });
        const dbCount = dbKeyCounts[key] || 0;
        const addedCount = addedKeyCounts[key] || 0;

        if (dbCount + addedCount < fileKeyCounts[key]) {
          addedKeyCounts[key] = addedCount + 1;
          return true;
        }
        return false;
      })
      .map((m) => ({
        ...m,
        carga_id: currentCargaId || null
      }));

    if (newMovements.length === 0) {
      return { success: true, count: 0, cargaId: currentCargaId || undefined };
    }

    const { data, error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .insert(newMovements)
      .select('id');

    if (error) throw error;

    return { success: true, count: data?.length || 0, cargaId: currentCargaId || undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al importar movimientos' };
  }
}

async function asociarMovimientosSinCarga(empresaId: string) {
  try {
    const { data: movsSinCarga, error: fetchErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('id, fecha, creado_en, retiro, deposito, cuenta_bancaria_id')
      .eq('empresa_id', empresaId)
      .is('carga_id', null);

    if (fetchErr || !movsSinCarga || movsSinCarga.length === 0) return;

    const grupos: { [key: string]: typeof movsSinCarga } = {};

    for (const m of movsSinCarga) {
      const fechaBase = m.creado_en ? new Date(m.creado_en).toISOString().substring(0, 10) : (m.fecha || 'Sin fecha');
      const cuentaKey = m.cuenta_bancaria_id || 'sin_cuenta';
      const groupKey = `${cuentaKey}_${fechaBase}`;

      if (!grupos[groupKey]) {
        grupos[groupKey] = [];
      }
      grupos[groupKey].push(m);
    }

    for (const key of Object.keys(grupos)) {
      const list = grupos[key];
      if (list.length === 0) continue;

      const cuentaId = list[0].cuenta_bancaria_id || null;
      const minDate = list[0].creado_en || new Date().toISOString();
      const fechaStr = new Date(minDate).toISOString().substring(0, 10);

      let totDep = 0;
      let totRet = 0;
      for (const item of list) {
        totDep += Number(item.deposito || 0);
        totRet += Number(item.retiro || 0);
      }

      const { data: newCarga, error: insertErr } = await supabaseAdmin
        .from('cargas_estados_cuenta')
        .insert({
          empresa_id: empresaId,
          cuenta_bancaria_id: cuentaId,
          nombre_archivo: `Carga Existente (${fechaStr})`,
          fecha_carga: minDate,
          total_registros: list.length,
          total_depositos: totDep,
          total_retiros: totRet,
          notas: 'Asociación automática de movimientos existentes en el sistema'
        })
        .select('id')
        .single();

      if (!insertErr && newCarga) {
        const ids = list.map(item => item.id);
        await supabaseAdmin
          .from('movimientos_bancarios')
          .update({ carga_id: newCarga.id })
          .in('id', ids);
      }
    }
  } catch (err) {
    console.error('Error al asociar movimientos sin carga:', err);
  }
}

export async function obtenerCargasEstadosCuenta(token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // Auto-asociar movimientos previamente subidos que aún no tengan carga_id
    await asociarMovimientosSinCarga(empresaId);

    const { data, error } = await supabaseAdmin
      .from('cargas_estados_cuenta')
      .select('*, cuentas_bancarias(nombre, numero_cuenta)')
      .eq('empresa_id', empresaId)
      .order('fecha_carga', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener historial de cargas' };
  }
}

export async function obtenerMovimientosPorCarga(cargaId: string, token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { data, error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*, estatus_conciliacion_bancaria(nombre, color), cuentas_bancarias(nombre), categorias_movimiento_bancario(nombre)')
      .eq('carga_id', cargaId)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener movimientos de la carga' };
  }
}

export async function eliminarCargaEstadoCuenta(cargaId: string, token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: movs, error: fetchErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('id')
      .eq('carga_id', cargaId)
      .eq('empresa_id', empresaId);

    if (fetchErr) throw fetchErr;

    const movIds = (movs || []).map(m => m.id);

    if (movIds.length > 0) {
      await supabaseAdmin
        .from('conciliaciones_bancarias')
        .delete()
        .in('movimiento_id', movIds);

      await supabaseAdmin
        .from('gastos')
        .update({ movimiento_bancario_id: null })
        .in('movimiento_bancario_id', movIds);

      await supabaseAdmin
        .from('pedidos')
        .update({ movimiento_bancario_id: null })
        .in('movimiento_bancario_id', movIds);
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('cargas_estados_cuenta')
      .delete()
      .eq('id', cargaId)
      .eq('empresa_id', empresaId);

    if (deleteErr) throw deleteErr;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar la carga de estado de cuenta' };
  }
}

// 2. TOGGLE VISIBILIDAD (CREA/DESTRUYE GASTO DE FORMA AUTOMÁTICA EN EGRESOS)
export async function toggleMovimientoVisibilidad(
  movimientoId: string,
  modulo: 'egresos' | 'ingresos',
  visible: boolean,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const field = modulo === 'egresos' ? 'visible_egresos' : 'visible_ingresos';
    
    // 1. Update movement visibility
    const { data: movement, error: updateErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({ [field]: visible })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    if (!movement) throw new Error('Movimiento no encontrado.');

    if (modulo === 'egresos') {
      if (visible) {
        // Create matching Gasto if not exists
        const { data: existingGasto } = await supabaseAdmin
          .from('gastos')
          .select('id')
          .eq('movimiento_bancario_id', movimientoId)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (!existingGasto) {
          let metodoPago = 'Transferencia';
          if (esMovimientoEfectivo(movement.concepto)) {
            metodoPago = 'Efectivo';
          }

          const { error: insertGastoErr } = await supabaseAdmin.from('gastos').insert({
            fecha_gasto: movement.fecha,
            concepto: movement.concepto,
            monto: Math.abs(movement.monto),
            metodo_pago: metodoPago,
            movimiento_bancario_id: movimientoId,
            estatus_facturado: false,
            empresa_id: empresaId
          });

          if (insertGastoErr) throw insertGastoErr;
        }
      } else {
        // Hide/Delete associated Gasto
        const { error: deleteGastoErr } = await supabaseAdmin
          .from('gastos')
          .delete()
          .eq('movimiento_bancario_id', movimientoId)
          .eq('empresa_id', empresaId);

        if (deleteGastoErr) throw deleteGastoErr;

        // Delete any junction relationships
        await supabaseAdmin
          .from('conciliaciones_bancarias')
          .delete()
          .eq('movimiento_id', movimientoId)
          .eq('empresa_id', empresaId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error toggling movement visibility:', err);
    return { success: false, error: err.message || 'Error al cambiar visibilidad' };
  }
}

// 3. CONCILIACIÓN INTELIGENTE / AUTOMÁTICA
export async function autoConciliarMovimientos(token: string): Promise<{ success: boolean; matchedCount: number; error?: string }> {
  try {
    await ensureBasicStatuses();
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId || empresaId === 'null') {
      throw new Error('Empresa inválida o no asignada to user.');
    }

    // Get all reconciliation statuses
    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');

    const getStatusId = (clave: string) => catalog?.find((c) => c.clave === clave)?.id || null;

    const statusPendiente = getStatusId('pendiente');
    if (!statusPendiente || statusPendiente === 'null') {
      throw new Error("No se encontró el estatus 'pendiente' en el catálogo.");
    }
    const statusComprobado = getStatusId('comprobado');
    const statusIncompletoComprobado = getStatusId('incompleto_comprobado');
    const statusNoDeducible = getStatusId('no_deducible');
    const statusNoDetectado = getStatusId('no_detectado');
    const statusConciliado = getStatusId('conciliado') || getStatusId('CONCILIADO') || statusComprobado;

    // 1. Get bank movements for this company that are candidates (pendiente, no_detectado, no_deducible, or null)
    const statusFilter = ['estatus_conciliacion_id.is.null'];
    if (statusPendiente) statusFilter.push(`estatus_conciliacion_id.eq.${statusPendiente}`);
    if (statusNoDetectado) statusFilter.push(`estatus_conciliacion_id.eq.${statusNoDetectado}`);
    if (statusNoDeducible) statusFilter.push(`estatus_conciliacion_id.eq.${statusNoDeducible}`);

    const { data: movements, error: movsErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('empresa_id', empresaId)
      .or(statusFilter.join(','))
      .order('fecha', { ascending: true });

    if (movsErr) throw movsErr;
    if (!movements || movements.length === 0) {
      return { success: true, matchedCount: 0 };
    }

    // 2. Get unmatched Gastos (retiros)
    const { data: pendingGastos } = await supabaseAdmin
      .from('gastos')
      .select('*, proveedores(rfc)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null);

    // 3. Get unmatched Pedidos (depositos)
    const { data: pendingPedidos } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(rfc)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null);

    let matchedCount = 0;

    for (const mov of movements) {
      // 1. SI EL MOVIMIENTO YA TIENE CONCILIACIÓN MANUAL REGISTRADA, NO TOCAR NUNCA
      const { data: existingConcs } = await supabaseAdmin
        .from('conciliaciones_bancarias')
        .select('id')
        .eq('movimiento_id', mov.id)
        .eq('empresa_id', empresaId)
        .limit(1);

      if (existingConcs && existingConcs.length > 0) {
        // Ignorar movimientos que fueron concilidados manualmente
        continue;
      }

      const isCash = esMovimientoEfectivo(mov.concepto);
      const isRetiro = mov.tipo_movimiento === 'Retiro';
      const absMonto = Math.abs(mov.monto);

      if (isRetiro) {
        if (isCash) {
          const hasTicket = !!mov.pdf_ticket_url || !!mov.xml_url;
          const targetStatus = hasTicket ? statusComprobado : statusIncompletoComprobado;
          
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({
              estatus_conciliacion_id: targetStatus,
              visible_egresos: true
            })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);

          const { data: existingGasto } = await supabaseAdmin
            .from('gastos')
            .select('id')
            .eq('movimiento_bancario_id', mov.id)
            .eq('empresa_id', empresaId)
            .maybeSingle();

          if (!existingGasto) {
            await supabaseAdmin.from('gastos').insert({
              fecha_gasto: mov.fecha,
              concepto: mov.concepto,
              monto: absMonto,
              metodo_pago: 'Efectivo',
              movimiento_bancario_id: mov.id,
              estatus_facturado: hasTicket,
              empresa_id: empresaId
            });
          }

          matchedCount++;
          continue;
        }

        const matches = (pendingGastos || [])
          .filter((g) => {
            const sameAmount = Math.abs(Number(g.monto) - absMonto) < 0.05;
            if (!sameAmount) return false;

            const gDate = parseDateOnly(g.fecha_gasto || g.fecha);
            const mDate = parseDateOnly(mov.fecha);
            if (!gDate || !mDate) return false;

            // La fecha de la factura (gDate) es anterior o igual al pago (mDate)
            const validDate = gDate.getTime() <= mDate.getTime();

            if (mov.rfc_proveedor && g.proveedores?.rfc) {
              const rfcMatch = mov.rfc_proveedor.toUpperCase() === g.proveedores.rfc.toUpperCase();
              return validDate && rfcMatch;
            }

            return validDate;
          })
          .sort((a, b) => {
            const dateA = parseDateOnly(a.fecha_gasto || a.fecha)?.getTime() || 0;
            const dateB = parseDateOnly(b.fecha_gasto || b.fecha)?.getTime() || 0;
            const mDateTime = parseDateOnly(mov.fecha)?.getTime() || 0;
            return Math.abs(dateA - mDateTime) - Math.abs(dateB - mDateTime);
          });

        // REGLA: SI HAY MÁS DE 1 COINCIDENCIA, HAY MARGEN DE ERROR / AMBIGÜEDAD -> MANDAR A ASIGNACIÓN MANUAL
        if (matches.length === 1) {
          const bestMatch = matches[0];
          const disc = detectarDiscrepanciaPago(mov.concepto, bestMatch.metodo_pago);
          let targetStatusId = statusConciliado;
          
          // Consolidar URLs para sincronización bidireccional
          const xmlToSet = mov.xml_url || bestMatch.xml_url || null;
          const pdfToSet = mov.pdf_factura_url || bestMatch.pdf_url || null;
          const ticketToSet = mov.pdf_ticket_url || bestMatch.ticket_url || null;

          if (disc.tieneDiscrepancia) {
            targetStatusId = statusNoDeducible || statusConciliado;
            await supabaseAdmin
              .from('gastos')
              .update({ 
                movimiento_bancario_id: mov.id, 
                estatus_facturado: true,
                es_deducible: false,
                comentarios: `[DISCREPANCIA FISCAL: ${disc.detalle}]${bestMatch.comentarios ? ' | ' + bestMatch.comentarios : ''}`.substring(0, 1000),
                ...(xmlToSet ? { xml_url: xmlToSet } : {}),
                ...(pdfToSet ? { pdf_url: pdfToSet } : {}),
                ...(ticketToSet ? { ticket_url: ticketToSet } : {})
              })
              .eq('id', bestMatch.id)
              .eq('empresa_id', empresaId);
          } else {
            await supabaseAdmin
              .from('gastos')
              .update({ 
                movimiento_bancario_id: mov.id, 
                estatus_facturado: true,
                ...(xmlToSet ? { xml_url: xmlToSet } : {}),
                ...(pdfToSet ? { pdf_url: pdfToSet } : {}),
                ...(ticketToSet ? { ticket_url: ticketToSet } : {})
              })
              .eq('id', bestMatch.id)
              .eq('empresa_id', empresaId);
          }

          await supabaseAdmin.from('conciliaciones_bancarias').insert({
            movimiento_id: mov.id,
            gasto_id: bestMatch.id,
            monto_asociado: absMonto,
            empresa_id: empresaId
          });

          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({
              estatus_conciliacion_id: targetStatusId,
              visible_egresos: true,
              xml_url: mov.xml_url || bestMatch.xml_url || null,
              pdf_factura_url: mov.pdf_factura_url || bestMatch.pdf_url || null,
              pdf_ticket_url: mov.pdf_ticket_url || bestMatch.ticket_url || null
            })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);

          if (pendingGastos) {
            const index = pendingGastos.indexOf(bestMatch);
            if (index > -1) pendingGastos.splice(index, 1);
          }

          matchedCount++;
        } else if (matches.length > 1) {
          // Existe ambigüedad (múltiples coincidencias) -> no auto-conciliar para evitar errores
          console.log(`Auto-conciliación omitida para movimiento de retiro ${mov.id}: ${matches.length} coincidencias encontradas. Requiere revisión manual.`);
        } else {
          // Si no se encuentra coincidencia, cambiar estatus a "Movimiento no detectado" (statusNoDetectado)
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({ estatus_conciliacion_id: statusNoDetectado || statusPendiente })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);
        }

      } else {
        const matches = (pendingPedidos || [])
          .filter((p) => {
            const sameAmount = Math.abs(Number(p.precio_total) - absMonto) < 0.05;
            if (!sameAmount) return false;

            const pDate = parseDateOnly(p.fecha_pedido || p.creado_en);
            const mDate = parseDateOnly(mov.fecha);
            if (!pDate || !mDate) return false;

            // La fecha del pedido/factura (pDate) es anterior o igual al pago (mDate)
            const validDate = pDate.getTime() <= mDate.getTime();

            return validDate;
          })
          .sort((a, b) => {
            const dateA = parseDateOnly(a.fecha_pedido || a.creado_en)?.getTime() || 0;
            const dateB = parseDateOnly(b.fecha_pedido || b.creado_en)?.getTime() || 0;
            const mDateTime = parseDateOnly(mov.fecha)?.getTime() || 0;
            return Math.abs(dateA - mDateTime) - Math.abs(dateB - mDateTime);
          });

        // REGLA: SI HAY MÁS DE 1 COINCIDENCIA, HAY MARGEN DE ERROR / AMBIGÜEDAD -> MANDAR A ASIGNACIÓN MANUAL
        if (matches.length === 1) {
          const bestMatch = matches[0];

          await supabaseAdmin
            .from('pedidos')
            .update({ movimiento_bancario_id: mov.id, estatus_pago: 'Liquidado' })
            .eq('id', bestMatch.id)
            .eq('empresa_id', empresaId);

          await supabaseAdmin.from('conciliaciones_bancarias').insert({
            movimiento_id: mov.id,
            pedido_id: bestMatch.id,
            monto_asociado: absMonto,
            empresa_id: empresaId
          });

          const { data: clientInvoice } = await supabaseAdmin
            .from('facturas_clientes')
            .select('xml_url, pdf_url, ticket_url')
            .eq('pedido_id', bestMatch.id)
            .eq('empresa_id', empresaId)
            .maybeSingle();

          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({
              estatus_conciliacion_id: statusConciliado,
              visible_ingresos: true,
              xml_url: clientInvoice?.xml_url || null,
              pdf_factura_url: clientInvoice?.pdf_url || null,
              pdf_ticket_url: clientInvoice?.ticket_url || null
            })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);

          if (pendingPedidos) {
            const index = pendingPedidos.indexOf(bestMatch);
            if (index > -1) pendingPedidos.splice(index, 1);
          }

          matchedCount++;
        } else if (matches.length > 1) {
          // Existe ambigüedad (múltiples pedidos con el mismo monto/fecha) -> dejar para asignación manual
          console.log(`Auto-conciliación omitida para movimiento de depósito ${mov.id}: ${matches.length} pedidos candidatos encontrados. Requiere revisión manual.`);
        } else {
          // Si no se encuentra coincidencia para depósito, dejar como pendiente o no detectado
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({ estatus_conciliacion_id: statusNoDetectado || statusPendiente })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);
        }
      }
    }

    return { success: true, matchedCount };
  } catch (err: any) {
    console.error('Error running auto reconciliation:', err);
    return { success: false, matchedCount: 0, error: err.message || 'Error al ejecutar conciliación automática' };
  }
}

// 4. CONCILIACIÓN MANUAL (SOPORTE UNO-A-MUCHOS, MUCHOS-A-UNO, MUCHOS-A-MUCHOS Y CARGA DE DOCUMENTOS DUAL)
export async function guardarConciliacionManual(
  movimientoId: string | string[],
  payload: {
    gastosIds: string[];
    pedidosIds: string[];
    xmlUrl?: string | null;
    pdfFacturaUrl?: string | null;
    pdfTicketUrl?: string | null;
    soporteReembolsoUrl?: string | null;
    storageProvider?: 'Supabase' | 'GoogleDrive';
    estatusClave?: string;
    comentarios?: string | null;
  },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId, userId } = await getUserEmpresaId(token);
    const targetMovIds = Array.isArray(movimientoId) ? movimientoId.filter(Boolean) : [movimientoId];

    if (targetMovIds.length === 0) throw new Error('Debe especificar al menos un movimiento bancario.');

    // 1. Obtener el ID del personal (usuarios_staff) para asociarlo al campo registrado_por del gasto
    const { data: staffData } = await supabaseAdmin
      .from('usuarios_staff')
      .select('id')
      .eq('supabase_auth_id', userId)
      .maybeSingle();
    const staffId = staffData?.id || null;

    const primaryMovId = targetMovIds[0];

    // 2. Procesar y auto-registrar en la tabla 'gastos' cualquier XML subido manualmente en este movimiento
    if (payload.xmlUrl) {
      const xmlPaths = payload.xmlUrl.split(',').filter(Boolean);
      for (const path of xmlPaths) {
        if (!path.toLowerCase().endsWith('.xml')) continue;

        try {
          // Descargar XML desde el storage
          const { data: fileData, error: downloadError } = await supabaseAdmin
            .storage
            .from('facturas')
            .download(path);

          if (!downloadError && fileData) {
            const xmlText = await fileData.text();
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
            const jsonObj = parser.parse(xmlText);
            const cfdi = jsonObj['cfdi:Comprobante'] || jsonObj['Comprobante'];

            if (cfdi) {
              const timbre = cfdi['cfdi:Complemento']?.['tfd:TimbreFiscalDigital'] || 
                             cfdi['cfdi:Complemento']?.['TimbreFiscalDigital'] || 
                             cfdi['Complemento']?.['tfd:TimbreFiscalDigital'] || 
                             cfdi['Complemento']?.['TimbreFiscalDigital'];
              const uuid = timbre?.['@_UUID'] || timbre?.['@_uuid'];

              if (uuid) {
                // Verificar si ya existe este gasto por su UUID fiscal
                const { data: existingGasto } = await supabaseAdmin
                  .from('gastos')
                  .select('id')
                  .eq('uuid_fiscal', uuid.toUpperCase())
                  .eq('empresa_id', empresaId)
                  .maybeSingle();

                let gastoId = existingGasto?.id;

                if (!gastoId) {
                  // Extraer campos del CFDI
                  const receptor = cfdi['cfdi:Receptor'] || cfdi['Receptor'];
                  const rfcReceptor = receptor?.['@_Rfc'] || receptor?.['@_rfc'];

                  // Validación estricta por RFC de la empresa
                  if (rfcReceptor && empresaId) {
                    const { data: empData } = await supabaseAdmin
                      .from('empresas')
                      .select('rfc')
                      .eq('id', empresaId)
                      .maybeSingle();

                    if (empData?.rfc && rfcReceptor.trim().toUpperCase() !== empData.rfc.trim().toUpperCase()) {
                      console.warn(`Saltando registro automático de gasto: RFC receptor del XML (${rfcReceptor}) no coincide con el RFC de la empresa activa (${empData.rfc}).`);
                      continue;
                    }
                  }

                  const emisor = cfdi['cfdi:Emisor'] || cfdi['Emisor'];
                  const rfcEmisor = emisor?.['@_Rfc'] || emisor?.['@_rfc'];
                  const nombreEmisor = emisor?.['@_Nombre'] || emisor?.['@_nombre'];

                  const total = parseFloat(cfdi['@_Total'] || cfdi['@_total'] || '0');
                  const subtotal = parseFloat(cfdi['@_SubTotal'] || cfdi['@_subtotal'] || '0') || total;
                  const fecha = cfdi['@_Fecha'] || cfdi['@_fecha'] || '';
                  const fecha_emision = fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0];
                  const serie = cfdi['@_Serie'] || cfdi['@_serie'] || '';
                  const folio = cfdi['@_Folio'] || cfdi['@_folio'] || '';
                  const folioStr = folio ? `${serie}${folio}`.trim() : (serie ? serie.trim() : '');
                  const formaPagoCode = cfdi['@_FormaPago'] || cfdi['@_formaPago'] || '';

                  // Extraer IVA
                  let globalIva = 0;
                  const impuestos = cfdi['cfdi:Impuestos'] || cfdi['Impuestos'];
                  const traslados = impuestos?.['cfdi:Traslados']?.['cfdi:Traslado'] || impuestos?.['Traslados']?.['Traslado'];
                  if (traslados) {
                    const trasladosArr = Array.isArray(traslados) ? traslados : [traslados];
                    for (const t of trasladosArr) {
                      if (t['@_Impuesto'] === '002') {
                        globalIva += parseFloat(t['@_Importe'] || '0');
                      }
                    }
                  }

                  // Obtener o registrar proveedor
                  let proveedorId = null;
                  if (rfcEmisor) {
                    const { data: prov } = await supabaseAdmin
                      .from('proveedores')
                      .select('id')
                      .eq('rfc', rfcEmisor.toUpperCase())
                      .eq('empresa_id', empresaId)
                      .maybeSingle();

                    if (prov) {
                      proveedorId = prov.id;
                    } else {
                      const { data: newProv, error: errP } = await supabaseAdmin
                        .from('proveedores')
                        .insert({
                          rfc: rfcEmisor.toUpperCase(),
                          nombre_comercial: nombreEmisor || rfcEmisor,
                          razon_social: nombreEmisor || rfcEmisor,
                          empresa_id: empresaId
                        })
                        .select('id')
                        .single();

                      if (!errP && newProv) {
                        proveedorId = newProv.id;
                      }
                    }
                  }

                  // Mapear método de pago y ID de forma_pago
                  const { data: formasPagoData } = await supabaseAdmin.from('formas_pago').select('id, nombre, codigo');
                  let formaPagoId = null;
                  let metodoPago = '99';
                  if (formasPagoData && formasPagoData.length > 0) {
                    const code = formaPagoCode ? String(formaPagoCode).trim().padStart(2, '0') : '03';
                    const match = formasPagoData.find(f => f.codigo === code);
                    if (match) {
                      formaPagoId = match.id;
                    } else {
                      formaPagoId = formasPagoData.find(f => f.codigo === '99')?.id || formasPagoData[0].id;
                    }

                    if (code === '01') metodoPago = 'Efectivo';
                    else if (code === '03') metodoPago = 'Transferencia';
                    else if (code === '04') metodoPago = 'Tarjeta de crédito';
                    else if (code === '28') metodoPago = 'Tarjeta de débito';
                    else if (code === '02') metodoPago = 'Cheque';
                    else metodoPago = 'Por definir';
                  }

                  // Estatus de factura por defecto (Facturado)
                  const { data: estatusData } = await supabaseAdmin
                    .from('estatus_factura')
                    .select('id')
                    .ilike('nombre', 'Facturado')
                    .maybeSingle();
                  let defaultEstatusId = estatusData?.id;
                  if (!defaultEstatusId) {
                    const { data: firstE } = await supabaseAdmin.from('estatus_factura').select('id').limit(1).maybeSingle();
                    defaultEstatusId = firstE?.id;
                  }

                  // Insertar nuevo Gasto en Egresos
                  const { data: newGastoData, error: insertGastoErr } = await supabaseAdmin
                    .from('gastos')
                    .insert({
                      folio_factura: folioStr || null,
                      uuid_fiscal: uuid.toUpperCase(),
                      monto: total,
                      subtotal: subtotal,
                      iva_acreditable: globalIva,
                      xml_url: path,
                      fecha_gasto: fecha_emision,
                      empresa_id: empresaId,
                      concepto: `Gasto por factura XML (UUID: ${uuid.substring(0, 8)})`,
                      registrado_por: staffId,
                      proveedor_id: proveedorId,
                      forma_pago_id: formaPagoId,
                      estatus_factura_id: defaultEstatusId,
                      estatus_facturado: true,
                      metodo_pago: metodoPago,
                      es_deducible: true,
                      movimiento_bancario_id: primaryMovId
                    })
                    .select('id')
                    .single();

                  if (!insertGastoErr && newGastoData) {
                    gastoId = newGastoData.id;
                  }
                }

                // Forzar vinculación agregándolo a la lista de gastosIds reconciliados
                if (gastoId && !payload.gastosIds.includes(gastoId)) {
                  payload.gastosIds.push(gastoId);
                }
              }
            }
          }
        } catch (xmlErr) {
          console.error('Error al procesar/registrar XML subido en conciliación:', xmlErr);
        }
      }
    }

    // 3. Obtener datos de los movimientos seleccionados
    const { data: targetMovements, error: movsErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .in('id', targetMovIds)
      .eq('empresa_id', empresaId);

    if (movsErr || !targetMovements || targetMovements.length === 0) throw new Error('Movimientos no encontrados.');

    const primaryMov = targetMovements.find(m => m.id === primaryMovId) || targetMovements[0];

    // Limpiar conciliaciones anteriores para todos los movimientos involucrados
    await supabaseAdmin
      .from('conciliaciones_bancarias')
      .delete()
      .in('movimiento_id', targetMovIds)
      .eq('empresa_id', empresaId);

    await supabaseAdmin
      .from('gastos')
      .update({ movimiento_bancario_id: null })
      .in('movimiento_bancario_id', targetMovIds)
      .eq('empresa_id', empresaId);

    await supabaseAdmin
      .from('pedidos')
      .update({ movimiento_bancario_id: null })
      .in('movimiento_bancario_id', targetMovIds)
      .eq('empresa_id', empresaId);

    let associatedXml = null;
    let associatedPdf = null;
    let associatedTicket = null;

    if (primaryMov.tipo_movimiento === 'Retiro' && payload.gastosIds.length > 0) {
      const isNoDeducible = payload.estatusClave === 'no_deducible';

      const xmlToSet = payload.xmlUrl || associatedXml || primaryMov.xml_url || null;
      const pdfToSet = payload.pdfFacturaUrl || associatedPdf || primaryMov.pdf_factura_url || null;
      const ticketToSet = payload.pdfTicketUrl || associatedTicket || primaryMov.pdf_ticket_url || null;

      const { error: linkErr } = await supabaseAdmin
        .from('gastos')
        .update({ 
          movimiento_bancario_id: primaryMovId, 
          estatus_facturado: true,
          ...(isNoDeducible ? { es_deducible: false } : {}),
          ...(xmlToSet ? { xml_url: xmlToSet } : {}),
          ...(pdfToSet ? { pdf_url: pdfToSet } : {}),
          ...(ticketToSet ? { ticket_url: ticketToSet } : {})
        })
        .in('id', payload.gastosIds)
        .eq('empresa_id', empresaId);

      if (linkErr) throw linkErr;

      const { data: gastosInfo } = await supabaseAdmin
        .from('gastos')
        .select('id, monto, xml_url, pdf_url, ticket_url')
        .in('id', payload.gastosIds)
        .eq('empresa_id', empresaId);

      if (gastosInfo) {
        const xmls: string[] = [];
        const pdfs: string[] = [];
        const tickets: string[] = [];
        for (const g of gastosInfo) {
          if (g.xml_url) xmls.push(...g.xml_url.split(',').filter(Boolean));
          if (g.pdf_url) pdfs.push(...g.pdf_url.split(',').filter(Boolean));
          if (g.ticket_url) tickets.push(...g.ticket_url.split(',').filter(Boolean));
        }
        if (xmls.length > 0) associatedXml = Array.from(new Set(xmls)).join(',');
        if (pdfs.length > 0) associatedPdf = Array.from(new Set(pdfs)).join(',');
        if (tickets.length > 0) associatedTicket = Array.from(new Set(tickets)).join(',');
      }

      // Junction entries for ALL target movements
      const junctionEntries: any[] = [];
      for (const mItem of targetMovements) {
        const movMonto = Math.abs(Number(mItem.monto) || Number(mItem.retiro) || 0);
        for (const gId of payload.gastosIds) {
          const gInfo = gastosInfo?.find((g) => g.id === gId);

          const { data: priorConcs } = await supabaseAdmin
            .from('conciliaciones_bancarias')
            .select('monto_asociado')
            .eq('gasto_id', gId)
            .neq('movimiento_id', mItem.id);

          const totalPrior = (priorConcs || []).reduce((s, c) => s + Number(c.monto_asociado || 0), 0);
          const totalGasto = gInfo ? Number(gInfo.monto || 0) : movMonto;
          const saldoPendiente = Math.max(0, totalGasto - totalPrior);

          const montoAsoc = targetMovIds.length > 1
            ? movMonto
            : (saldoPendiente > 0 ? Math.min(movMonto, saldoPendiente) : movMonto);

          junctionEntries.push({
            movimiento_id: mItem.id,
            gasto_id: gId,
            monto_asociado: montoAsoc,
            empresa_id: empresaId
          });
        }
      }

      const { error: jErr } = await supabaseAdmin.from('conciliaciones_bancarias').insert(junctionEntries);
      if (jErr) throw jErr;
    }

    if (primaryMov.tipo_movimiento === 'Deposito' && payload.pedidosIds.length > 0) {
      const { error: linkErr } = await supabaseAdmin
        .from('pedidos')
        .update({ movimiento_bancario_id: primaryMovId, estatus_pago: 'Liquidado' })
        .in('id', payload.pedidosIds)
        .eq('empresa_id', empresaId);

      if (linkErr) throw linkErr;

      const { data: pedidosInfo } = await supabaseAdmin
        .from('pedidos')
        .select('id, precio_total')
        .in('id', payload.pedidosIds)
        .eq('empresa_id', empresaId);

      const { data: pedidosFiles } = await supabaseAdmin
        .from('facturas_clientes')
        .select('xml_url, pdf_url, ticket_url')
        .in('pedido_id', payload.pedidosIds)
        .eq('empresa_id', empresaId);

      if (pedidosFiles) {
        const xmls: string[] = [];
        const pdfs: string[] = [];
        const tickets: string[] = [];
        for (const f of pedidosFiles) {
          if (f.xml_url) xmls.push(...f.xml_url.split(',').filter(Boolean));
          if (f.pdf_url) pdfs.push(...f.pdf_url.split(',').filter(Boolean));
          if (f.ticket_url) tickets.push(...f.ticket_url.split(',').filter(Boolean));
        }
        if (xmls.length > 0) associatedXml = Array.from(new Set(xmls)).join(',');
        if (pdfs.length > 0) associatedPdf = Array.from(new Set(pdfs)).join(',');
        if (tickets.length > 0) associatedTicket = Array.from(new Set(tickets)).join(',');
      }

      // Junction entries for ALL target movements
      const junctionEntries: any[] = [];
      for (const mItem of targetMovements) {
        const movMonto = Math.abs(Number(mItem.monto) || Number(mItem.deposito) || 0);
        for (const pId of payload.pedidosIds) {
          const pInfo = pedidosInfo?.find((p) => p.id === pId);

          const { data: priorConcs } = await supabaseAdmin
            .from('conciliaciones_bancarias')
            .select('monto_asociado')
            .eq('pedido_id', pId)
            .neq('movimiento_id', mItem.id);

          const totalPrior = (priorConcs || []).reduce((s, c) => s + Number(c.monto_asociado || 0), 0);
          const totalPedido = pInfo ? Number(pInfo.precio_total || 0) : movMonto;
          const saldoPendiente = Math.max(0, totalPedido - totalPrior);

          const montoAsoc = targetMovIds.length > 1
            ? movMonto
            : (saldoPendiente > 0 ? Math.min(movMonto, saldoPendiente) : movMonto);

          junctionEntries.push({
            movimiento_id: mItem.id,
            pedido_id: pId,
            monto_asociado: montoAsoc,
            empresa_id: empresaId
          });
        }
      }

      const { error: jErr } = await supabaseAdmin.from('conciliaciones_bancarias').insert(junctionEntries);
      if (jErr) throw jErr;
    }

    // Verificar si el periodo del movimiento pertenece a un ciclo cerrado
    const movDateStr = primaryMov.fecha ? String(primaryMov.fecha).substring(0, 7) : null;
    let isClosedPeriod = false;
    if (movDateStr) {
      const { data: cierreRecord } = await supabaseAdmin
        .from('cierres_mensuales')
        .select('estatus')
        .eq('empresa_id', empresaId)
        .eq('mes', movDateStr)
        .maybeSingle();

      if (cierreRecord && (cierreRecord.estatus === 'cerrado' || cierreRecord.estatus === 'cerrado_definitivo' || cierreRecord.estatus === 'pre_cerrado')) {
        isClosedPeriod = true;
      }
    }

    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');

    const getStatusId = (clave: string) => catalog?.find((c) => c.clave === clave)?.id || null;

    let targetStatusClave = payload.estatusClave || 'pendiente';
    if (!payload.estatusClave) {
      const hasXml = !!payload.xmlUrl || !!primaryMov.xml_url || !!associatedXml;
      const hasTicket = !!payload.pdfTicketUrl || !!primaryMov.pdf_ticket_url || !!associatedTicket;
      const hasSoporte = !!payload.soporteReembolsoUrl || !!primaryMov.soporte_reembolso_url;
      const isCash = esMovimientoEfectivo(primaryMov.concepto);

      if (hasSoporte) {
        targetStatusClave = 'comprobado';
      } else if (isCash) {
        targetStatusClave = hasTicket ? 'comprobado' : 'incompleto_comprobado';
      } else {
        const hasInvoice = (primaryMov.tipo_movimiento === 'Deposito') || (payload.gastosIds.length > 0);
        if (!hasInvoice) {
          targetStatusClave = 'no_deducible';
        } else if (hasXml) {
          targetStatusClave = 'comprobado';
        } else {
          targetStatusClave = 'incompleto_comprobado';
        }
      }
    }

    const targetStatusId = getStatusId(targetStatusClave);

    const updatePayload: any = {
      estatus_conciliacion_id: targetStatusId,
      visible_egresos: primaryMov.tipo_movimiento === 'Retiro' && payload.gastosIds.length > 0,
      visible_ingresos: primaryMov.tipo_movimiento === 'Deposito' && payload.pedidosIds.length > 0
    };

    const mergeUrls = (...sources: (string | null | undefined)[]) => {
      const all = sources
        .filter(Boolean)
        .flatMap((s) => (s as string).split(','))
        .map((s) => s.trim())
        .filter(Boolean);
      return all.length > 0 ? Array.from(new Set(all)).join(',') : null;
    };

    updatePayload.xml_url = mergeUrls(payload.xmlUrl, associatedXml, primaryMov.xml_url);
    updatePayload.pdf_factura_url = mergeUrls(payload.pdfFacturaUrl, associatedPdf, primaryMov.pdf_factura_url);
    updatePayload.pdf_ticket_url = mergeUrls(payload.pdfTicketUrl, associatedTicket, primaryMov.pdf_ticket_url);
    updatePayload.soporte_reembolso_url = mergeUrls(payload.soporteReembolsoUrl, primaryMov.soporte_reembolso_url);
    updatePayload.soporte_reembolso_url = payload.soporteReembolsoUrl || primaryMov.soporte_reembolso_url || null;
    if (payload.storageProvider !== undefined) updatePayload.storage_provider = payload.storageProvider;

    // Gestión de comentarios con nota de cierre si el periodo estaba cerrado
    let finalComentarios = payload.comentarios !== undefined ? (payload.comentarios || '') : (primaryMov.comentarios || '');
    if (isClosedPeriod && !finalComentarios.includes('Conciliado después del periodo de cierre')) {
      const todayStr = new Date().toISOString().split('T')[0];
      const postCloseTag = `[Conciliado después del periodo de cierre - Registrado el ${todayStr}]`;
      finalComentarios = finalComentarios ? `${finalComentarios.trim()}\n${postCloseTag}` : postCloseTag;
    }
    updatePayload.comentarios = finalComentarios || null;

    const { error: updateMovErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update(updatePayload)
      .in('id', targetMovIds)
      .eq('empresa_id', empresaId);

    if (updateMovErr) throw updateMovErr;

    // Si el periodo estaba cerrado y se asociaron gastos, marcar es_deducible = true y agregar la nota al gasto
    if (isClosedPeriod && payload.gastosIds && payload.gastosIds.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const postCloseTag = `[Conciliado después del periodo de cierre - Registrado el ${todayStr}]`;

      for (const gId of payload.gastosIds) {
        const { data: gData } = await supabaseAdmin
          .from('gastos')
          .select('comentarios')
          .eq('id', gId)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        let gComms = gData?.comentarios || '';
        if (!gComms.includes('Conciliado después del periodo de cierre')) {
          gComms = gComms ? `${gComms.trim()}\n${postCloseTag}` : postCloseTag;
        }

        await supabaseAdmin
          .from('gastos')
          .update({
            es_deducible: true,
            comentarios: gComms
          })
          .eq('id', gId)
          .eq('empresa_id', empresaId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving manual reconciliation:', err);
    return { success: false, error: err.message || 'Error al guardar conciliación manual' };
  }
}

// 5. OBTENER CATALOGO DE ESTATUS DE CONCILIACIÓN
export async function getEstatusCatalog(token: string): Promise<{ success: boolean; catalog?: any[]; error?: string }> {
  try {
    await ensureBasicStatuses();
    const { empresaId } = await getUserEmpresaId(token);

    const { data, error } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('*')
      .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return { success: true, catalog: data || [] };
  } catch (err: any) {
    console.error('Error getting status catalog:', err);
    return { success: false, error: err.message || 'Error al cargar catálogo de estatus' };
  }
}

// 6. ACTUALIZAR / CREAR ESTATUS EN EL CATALOGO (CATALOGO EXPANDIBLE Y ACTUALIZABLE)
export async function guardarEstatusCatalogItem(
  payload: {
    id?: string;
    clave?: string;
    nombre: string;
    descripcion?: string;
    color: string;
  },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    if (payload.id) {
      const { error } = await supabaseAdmin
        .from('estatus_conciliacion_bancaria')
        .update({
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          color: payload.color
        })
        .eq('id', payload.id)
        .eq('empresa_id', empresaId);

      if (error) throw error;
    } else {
      const clave = (payload.clave || payload.nombre).toLowerCase().replace(/\s+/g, '_');
      const { error } = await supabaseAdmin
        .from('estatus_conciliacion_bancaria')
        .insert({
          clave,
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          color: payload.color,
          empresa_id: empresaId
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving status catalog item:', err);
    return { success: false, error: err.message || 'Error al guardar estatus del catálogo' };
  }
}

// 7. ELIMINAR ESTATUS PERSONALIZADO DEL CATALOGO
export async function eliminarEstatusCatalogItem(id: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { error } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .not('empresa_id', 'is', null);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting status catalog item:', err);
    return { success: false, error: err.message || 'Error al eliminar estatus' };
  }
}

// 8. ELIMINAR MOVIMIENTO BANCARIO (solo si NO está conciliado)
export async function eliminarMovimientoBancario(movimientoId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: conciliacion } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .select('id')
      .eq('movimiento_id', movimientoId)
      .eq('empresa_id', empresaId)
      .limit(1)
      .maybeSingle();

    if (conciliacion) {
      throw new Error('No se puede eliminar un movimiento bancario que ya se encuentra conciliado.');
    }

    await supabaseAdmin
      .from('gastos')
      .delete()
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    const { error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .delete()
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting bank movement:', err);
    return { success: false, error: err.message || 'Error al eliminar el movimiento bancario' };
  }
}

// 9. EDITAR MOVIMIENTO BANCARIO (solo si NO está conciliado)
export async function editarMovimientoBancario(
  movimientoId: string,
  updates: { fecha: string; concepto: string; retiro: number; deposito: number },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: conciliacion } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .select('id')
      .eq('movimiento_id', movimientoId)
      .eq('empresa_id', empresaId)
      .limit(1)
      .maybeSingle();

    if (conciliacion) {
      throw new Error('No se puede editar un movimiento bancario que ya se encuentra conciliado.');
    }

    const rfc = extraerRfcDeConcepto(updates.concepto);
    const monto = Math.abs(updates.deposito) - Math.abs(updates.retiro);
    const tipo_movimiento = updates.deposito > 0 ? 'Deposito' : 'Retiro';

    const { error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({
        fecha: updates.fecha,
        concepto: updates.concepto,
        retiro: Math.abs(updates.retiro),
        deposito: Math.abs(updates.deposito),
        monto: monto,
        tipo_movimiento,
        rfc_proveedor: rfc
      })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    
    // Actualizar posible gasto vinculado por visibilidad
    await supabaseAdmin
      .from('gastos')
      .update({
        fecha_gasto: updates.fecha,
        concepto: updates.concepto,
        monto: Math.abs(monto)
      })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    return { success: true };
  } catch (err: any) {
    console.error('Error editing bank movement:', err);
    return { success: false, error: err.message || 'Error al editar el movimiento bancario' };
  }
}

// 10. DESCONCILIAR MOVIMIENTO BANCARIO
export async function desconciliarMovimientoBancario(
  movimientoId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // 1. Get the Pendiente status ID
    const { data: statusPendiente } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'pendiente')
      .single();

    const estatusId = statusPendiente?.id || null;

    // 2. Remove bank movement references from linked gastos
    const { error: resetGastosErr } = await supabaseAdmin
      .from('gastos')
      .update({ movimiento_bancario_id: null })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    if (resetGastosErr) throw resetGastosErr;

    // 3. Remove bank movement references from linked pedidos
    const { error: resetPedidosErr } = await supabaseAdmin
      .from('pedidos')
      .update({ movimiento_bancario_id: null, estatus_pago: 'Pendiente' })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    if (resetPedidosErr) throw resetPedidosErr;

    // 4. Delete the junction entries in conciliaciones_bancarias
    const { error: deleteJuncErr } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .delete()
      .eq('movimiento_id', movimientoId)
      .eq('empresa_id', empresaId);

    if (deleteJuncErr) throw deleteJuncErr;

    // 5. Update the movements table: reset status, files, and visibility
    const { data: currentMov } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('movimiento_reembolso_id')
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId)
      .single();

    if (currentMov?.movimiento_reembolso_id) {
      await supabaseAdmin
        .from('movimientos_bancarios')
        .update({
          estatus_conciliacion_id: estatusId,
          visible_egresos: false,
          visible_ingresos: false,
          xml_url: null,
          pdf_factura_url: null,
          pdf_ticket_url: null,
          soporte_reembolso_url: null,
          comentarios: null,
          movimiento_reembolso_id: null
        })
        .eq('id', currentMov.movimiento_reembolso_id)
        .eq('empresa_id', empresaId);
    }

    const { error: updateMovErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({
        estatus_conciliacion_id: estatusId,
        visible_egresos: false,
        visible_ingresos: false,
        xml_url: null,
        pdf_factura_url: null,
        pdf_ticket_url: null,
        soporte_reembolso_url: null,
        comentarios: null,
        movimiento_reembolso_id: null
      })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (updateMovErr) throw updateMovErr;

    return { success: true };
  } catch (err: any) {
    console.error('Error unlinking reconciliation:', err);
    return { success: false, error: err.message || 'Error al desconciliar el movimiento bancario' };
  }
}

export async function conciliarGastoEfectivoAutomatico(
  gastoId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // 1. Obtener detalles del gasto
    const { data: gasto, error: gErr } = await supabaseAdmin
      .from('gastos')
      .select('*, proveedores(rfc)')
      .eq('id', gastoId)
      .eq('empresa_id', empresaId)
      .single();

    if (gErr || !gasto) throw new Error('Gasto no encontrado.');

    // Validar que sea efectivo
    const metodo = String(gasto.metodo_pago || '').toLowerCase();
    if (!metodo.includes('efectivo') && !metodo.includes('01')) {
      return { success: true }; // No hacer nada si no es efectivo
    }

    // 2. Buscar cuenta de Caja Chica
    const { data: accounts } = await supabaseAdmin
      .from('cuentas_bancarias')
      .select('id, nombre')
      .eq('empresa_id', empresaId);

    let cajaChica = accounts?.find(a => a.nombre.toUpperCase().includes('CAJA CHICA'));
    if (!cajaChica) {
      // Si no existe, crear una cuenta de Caja Chica por defecto
      const { data: newCaja, error: createAccErr } = await supabaseAdmin
        .from('cuentas_bancarias')
        .insert({
          nombre: 'Caja Chica',
          moneda: 'MXN',
          empresa_id: empresaId
        })
        .select('id, nombre')
        .single();
      if (createAccErr) throw createAccErr;
      cajaChica = newCaja;
    }

    // 3. Obtener el estatus 'comprobado' (Conciliado)
    const { data: statusConciliado } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'comprobado')
      .single();

    if (!statusConciliado) throw new Error('Estatus de conciliación "comprobado" no encontrado.');

    // 4. Crear el movimiento bancario correspondiente en Caja Chica
    const { data: movement, error: movError } = await supabaseAdmin
      .from('movimientos_bancarios')
      .insert({
        fecha: gasto.fecha_gasto,
        concepto: gasto.concepto || 'Gasto en Efectivo',
        retiro: gasto.monto,
        deposito: 0,
        monto: -gasto.monto,
        tipo_movimiento: 'Retiro',
        cuenta_bancaria_id: cajaChica.id,
        estatus_conciliacion_id: statusConciliado.id,
        empresa_id: empresaId,
        visible_egresos: true,
        visible_ingresos: false,
        rfc_proveedor: gasto.proveedores?.rfc || null
      })
      .select('id')
      .single();

    if (movError || !movement) throw movError || new Error('No se pudo crear el movimiento bancario.');

    // 5. Vincular el gasto con el movimiento bancario
    const { error: updateGastoErr } = await supabaseAdmin
      .from('gastos')
      .update({ movimiento_bancario_id: movement.id })
      .eq('id', gasto.id)
      .eq('empresa_id', empresaId);

    if (updateGastoErr) throw updateGastoErr;

    // 6. Registrar en conciliaciones_bancarias
    const { error: jErr } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .insert({
        movimiento_id: movement.id,
        gasto_id: gasto.id,
        monto_asociado: gasto.monto,
        empresa_id: empresaId
      });

    if (jErr) throw jErr;

    return { success: true };
  } catch (err: any) {
    console.error('Error in conciliarGastoEfectivoAutomatico:', err);
    return { success: false, error: err.message || 'Error al auto-conciliar gasto en efectivo.' };
  }
}

export async function actualizarMesConciliacionMovimiento(
  movimientoId: string,
  mesConciliacion: string | null,
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({ mes_conciliacion: mesConciliacion })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in actualizarMesConciliacionMovimiento:', err);
    return { success: false, error: err.message || 'Error al vincular el movimiento a otro mes.' };
  }
}

export async function crearComprobanteDeposito(
  payload: {
    tipo: 'deposito_ventanilla' | 'corte_tarjeta' | 'corte_pos' | 'corte_bbva' | 'corte_parrot' | string;
    fecha: string;
    monto: number;
    descripcion?: string;
    archivo_url?: string;
    storage_provider?: 'Supabase' | 'GoogleDrive';
    cuenta_bancaria_id?: string | null;
    movimiento_bancario_id?: string | null;
    monto_debito?: number;
    monto_credito?: number;
    propina_debito?: number;
    propina_credito?: number;
    monto_amex?: number;
    propina_amex?: number;
    monto_efectivo?: number;
    monto_parrotpay?: number;
    propina_efectivo?: number;
    propina_parrotpay?: number;
    comision_transacciones?: number;
    iva_transacciones?: number;
    otros_cargos?: number;
  },
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const insertPayload: any = {
      tipo: payload.tipo,
      fecha: payload.fecha,
      monto: payload.monto,
      descripcion: payload.descripcion || null,
      archivo_url: payload.archivo_url || null,
      storage_provider: payload.storage_provider || 'Supabase',
      cuenta_bancaria_id: payload.cuenta_bancaria_id || null,
      empresa_id: empresaId,
      monto_debito: payload.monto_debito || 0,
      monto_credito: payload.monto_credito || 0,
      propina_debito: payload.propina_debito || 0,
      propina_credito: payload.propina_credito || 0,
      monto_amex: payload.monto_amex || 0,
      propina_amex: payload.propina_amex || 0,
      monto_efectivo: payload.monto_efectivo || 0,
      monto_parrotpay: payload.monto_parrotpay || 0,
      propina_efectivo: payload.propina_efectivo || 0,
      propina_parrotpay: payload.propina_parrotpay || 0,
      comision_transacciones: payload.comision_transacciones || 0,
      iva_transacciones: payload.iva_transacciones || 0,
      otros_cargos: payload.otros_cargos || 0
    };

    let { data, error } = await supabaseAdmin
      .from('comprobantes_deposito')
      .insert(insertPayload)
      .select()
      .single();

    if (error && (error.message?.includes('comprobantes_deposito_tipo_check') || error.code === '23514')) {
      console.warn('comprobantes_deposito_tipo_check active in DB, retrying insert with corte_tarjeta fallback');
      insertPayload.tipo = 'corte_tarjeta';
      const retryRes = await supabaseAdmin
        .from('comprobantes_deposito')
        .insert(insertPayload)
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) throw error;

    if (payload.movimiento_bancario_id) {
      const { error: relErr } = await supabaseAdmin
        .from('comprobantes_deposito_movimientos')
        .insert({
          comprobante_id: data.id,
          movimiento_id: payload.movimiento_bancario_id,
          monto_asociado: payload.monto,
          empresa_id: empresaId
        });
      if (relErr) throw relErr;
      await autoActualizarEstatusMovimiento(payload.movimiento_bancario_id, empresaId);
    }

    await syncCajaChicaForComprobante(data, empresaId);

    return { success: true, comprobante: data };
  } catch (err: any) {
    console.error('Error in crearComprobanteDeposito:', err);
    return { success: false, error: err.message || 'Error al crear comprobante.' };
  }
}

export async function actualizarComprobanteDeposito(
  id: string,
  payload: {
    tipo: 'deposito_ventanilla' | 'corte_tarjeta' | 'corte_pos' | 'corte_bbva' | 'corte_parrot' | string;
    fecha: string;
    monto: number;
    descripcion?: string;
    archivo_url?: string;
    storage_provider?: 'Supabase' | 'GoogleDrive';
    cuenta_bancaria_id?: string | null;
    monto_debito?: number;
    monto_credito?: number;
    propina_debito?: number;
    propina_credito?: number;
    monto_amex?: number;
    propina_amex?: number;
    monto_efectivo?: number;
    monto_parrotpay?: number;
    propina_efectivo?: number;
    propina_parrotpay?: number;
    comision_transacciones?: number;
    iva_transacciones?: number;
    otros_cargos?: number;
  },
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const updatePayload: any = {
      tipo: payload.tipo,
      fecha: payload.fecha,
      monto: payload.monto,
      descripcion: payload.descripcion || null,
      archivo_url: payload.archivo_url || null,
      storage_provider: payload.storage_provider || 'Supabase',
      cuenta_bancaria_id: payload.cuenta_bancaria_id || null,
      monto_debito: payload.monto_debito || 0,
      monto_credito: payload.monto_credito || 0,
      propina_debito: payload.propina_debito || 0,
      propina_credito: payload.propina_credito || 0,
      monto_amex: payload.monto_amex || 0,
      propina_amex: payload.propina_amex || 0,
      monto_efectivo: payload.monto_efectivo || 0,
      monto_parrotpay: payload.monto_parrotpay || 0,
      propina_efectivo: payload.propina_efectivo || 0,
      propina_parrotpay: payload.propina_parrotpay || 0,
      comision_transacciones: payload.comision_transacciones || 0,
      iva_transacciones: payload.iva_transacciones || 0,
      otros_cargos: payload.otros_cargos || 0
    };

    let { data, error } = await supabaseAdmin
      .from('comprobantes_deposito')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error && (error.message?.includes('comprobantes_deposito_tipo_check') || error.code === '23514')) {
      console.warn('comprobantes_deposito_tipo_check active in DB, retrying update with corte_tarjeta fallback');
      updatePayload.tipo = 'corte_tarjeta';
      const retryRes = await supabaseAdmin
        .from('comprobantes_deposito')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) throw error;

    await syncCajaChicaForComprobante(data, empresaId);

    return { success: true, comprobante: data };
  } catch (err: any) {
    console.error('Error in actualizarComprobanteDeposito:', err);
    return { success: false, error: err.message || 'Error al actualizar comprobante.' };
  }
}

export async function eliminarComprobanteDeposito(id: string, token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { data: rels } = await supabaseAdmin
      .from('comprobantes_deposito_movimientos')
      .select('movimiento_id')
      .eq('comprobante_id', id);

    await removeCajaChicaForComprobante(id, empresaId);

    const { error } = await supabaseAdmin
      .from('comprobantes_deposito')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (error) throw error;

    if (rels && rels.length > 0) {
      for (const rel of rels) {
        await autoActualizarEstatusMovimiento(rel.movimiento_id, empresaId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error in eliminarComprobanteDeposito:', err);
    return { success: false, error: err.message || 'Error al eliminar comprobante.' };
  }
}

async function syncCajaChicaForComprobante(comprobante: any, empresaId: string) {
  try {
    const { data: accounts } = await supabaseAdmin
      .from('cuentas_bancarias')
      .select('id, nombre')
      .eq('empresa_id', empresaId);

    let cajaChica = accounts?.find(a => a.nombre.toUpperCase().includes('CAJA CHICA'));
    if (!cajaChica) {
      const { data: newCaja } = await supabaseAdmin
        .from('cuentas_bancarias')
        .insert({ nombre: 'Caja Chica', moneda: 'MXN', empresa_id: empresaId })
        .select('id, nombre')
        .single();
      if (newCaja) cajaChica = newCaja;
    }
    if (!cajaChica) return;

    const { data: statusComprobado } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'comprobado')
      .single();

    const refIngreso = `COMPROBANTE_EFECTIVO_${comprobante.id}`;
    const refEgreso = `COMPROBANTE_DEPOSITO_BBVA_${comprobante.id}`;

    // 1. REGISTRAR ENTRADA DE EFECTIVO EN CAJA CHICA (Únicamente cortes de venta, no depósitos en ventanilla)
    const isCorteVenta = comprobante.tipo !== 'deposito_ventanilla';
    const montoEfectivo = isCorteVenta ? (Number(comprobante.monto_efectivo || 0) + Number(comprobante.propina_efectivo || 0)) : 0;
    const { data: existingIngreso } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('id')
      .eq('referencia', refIngreso)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (montoEfectivo > 0) {
      const payloadIngreso = {
        fecha: comprobante.fecha,
        concepto: `Venta en Efectivo (Parrot POS - ${comprobante.descripcion || comprobante.fecha})`,
        deposito: montoEfectivo,
        retiro: 0,
        monto: montoEfectivo,
        tipo_movimiento: 'Deposito',
        referencia: refIngreso,
        cuenta_bancaria_id: cajaChica.id,
        estatus_conciliacion_id: statusComprobado?.id || null,
        empresa_id: empresaId,
        visible_ingresos: true,
        visible_egresos: false
      };
      if (existingIngreso) {
        await supabaseAdmin.from('movimientos_bancarios').update(payloadIngreso).eq('id', existingIngreso.id);
      } else {
        await supabaseAdmin.from('movimientos_bancarios').insert(payloadIngreso);
      }
    } else if (existingIngreso) {
      await supabaseAdmin.from('movimientos_bancarios').delete().eq('id', existingIngreso.id);
    }

    // 2. REGISTRAR DESCUENTO / SALIDA DE CAJA CHICA AL DEPOSITAR EL EFECTIVO A BANCO BBVA
    const isDepositoABanco = comprobante.tipo === 'deposito_ventanilla' && comprobante.cuenta_bancaria_id && comprobante.cuenta_bancaria_id !== cajaChica.id;
    const montoDescuento = Number(comprobante.monto || 0);

    const { data: existingEgreso } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('id')
      .eq('referencia', refEgreso)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (isDepositoABanco && montoDescuento > 0) {
      const payloadEgreso = {
        fecha: comprobante.fecha,
        concepto: `Descuento Caja Chica por Depósito de Efectivo a Banco (${comprobante.descripcion || comprobante.fecha})`,
        deposito: 0,
        retiro: montoDescuento,
        monto: -montoDescuento,
        tipo_movimiento: 'Retiro',
        referencia: refEgreso,
        cuenta_bancaria_id: cajaChica.id,
        estatus_conciliacion_id: statusComprobado?.id || null,
        empresa_id: empresaId,
        visible_ingresos: false,
        visible_egresos: true
      };
      if (existingEgreso) {
        await supabaseAdmin.from('movimientos_bancarios').update(payloadEgreso).eq('id', existingEgreso.id);
      } else {
        await supabaseAdmin.from('movimientos_bancarios').insert(payloadEgreso);
      }
    } else if (existingEgreso) {
      await supabaseAdmin.from('movimientos_bancarios').delete().eq('id', existingEgreso.id);
    }
  } catch (err) {
    console.error('Error syncing Caja Chica for comprobante:', err);
  }
}

export async function resyncAllCajaChicaComprobantesAction(empresaId: string) {
  try {
    const { data: comprobantes } = await supabaseAdmin
      .from('comprobantes_deposito')
      .select('*')
      .eq('empresa_id', empresaId);

    if (comprobantes) {
      for (const comp of comprobantes) {
        await syncCajaChicaForComprobante(comp, empresaId);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error resyncing Caja Chica:', err);
    return { success: false, error: err.message };
  }
}

async function removeCajaChicaForComprobante(comprobanteId: string, empresaId: string) {
  try {
    const refIngreso = `COMPROBANTE_EFECTIVO_${comprobanteId}`;
    const refEgreso = `COMPROBANTE_DEPOSITO_BBVA_${comprobanteId}`;
    await supabaseAdmin
      .from('movimientos_bancarios')
      .delete()
      .or(`referencia.eq.${refIngreso},referencia.eq.${refEgreso}`)
      .eq('empresa_id', empresaId);
  } catch (err) {
    console.error('Error removing Caja Chica movements for comprobante:', err);
  }
}

export async function vincularComprobanteAMovimiento(
  comprobanteId: string,
  movimientoBancarioId: string,
  token: string,
  montoAsociadoCustom?: number
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    
    let monto = montoAsociadoCustom;
    if (!monto) {
      const { data: comp } = await supabaseAdmin
        .from('comprobantes_deposito')
        .select('monto')
        .eq('id', comprobanteId)
        .single();
      monto = comp ? Number(comp.monto) : 0;
    }

    const { error } = await supabaseAdmin
      .from('comprobantes_deposito_movimientos')
      .insert({
        comprobante_id: comprobanteId,
        movimiento_id: movimientoBancarioId,
        monto_asociado: monto,
        empresa_id: empresaId
      });

    if (error) throw error;

    await autoActualizarEstatusMovimiento(movimientoBancarioId, empresaId);

    return { success: true };
  } catch (err: any) {
    console.error('Error in vincularComprobanteAMovimiento:', err);
    return { success: false, error: err.message || 'Error al vincular comprobante.' };
  }
}

export async function desvincularComprobanteDeMovimiento(
  comprobanteId: string,
  movimientoBancarioId: string | null,
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    
    let movsToUpdate: string[] = [];
    if (movimientoBancarioId) {
      movsToUpdate = [movimientoBancarioId];
    } else {
      const { data: rels } = await supabaseAdmin
        .from('comprobantes_deposito_movimientos')
        .select('movimiento_id')
        .eq('comprobante_id', comprobanteId);
      movsToUpdate = rels?.map(r => r.movimiento_id) || [];
    }

    let query = supabaseAdmin
      .from('comprobantes_deposito_movimientos')
      .delete()
      .eq('comprobante_id', comprobanteId)
      .eq('empresa_id', empresaId);

    if (movimientoBancarioId) {
      query = query.eq('movimiento_id', movimientoBancarioId);
    }

    const { error } = await query;
    if (error) throw error;

    for (const movId of movsToUpdate) {
      await autoActualizarEstatusMovimiento(movId, empresaId);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error in desvincularComprobanteDeMovimiento:', err);
    return { success: false, error: err.message || 'Error al desvincular comprobante.' };
  }
}

export async function obtenerComprobantesDeposito(token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { data, error } = await supabaseAdmin
      .from('comprobantes_deposito')
      .select(`
        *,
        cuentas_bancarias(*),
        comprobantes_deposito_movimientos(
          *,
          movimientos_bancarios(*)
        )
      `)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return { success: true, comprobantes: data };
  } catch (err: any) {
    console.error('Error in obtenerComprobantesDeposito:', err);
    return { success: false, error: err.message || 'Error al obtener comprobantes.' };
  }
}

async function autoActualizarEstatusMovimiento(movimientoId: string, empresaId: string) {
  const { data: mov } = await supabaseAdmin
    .from('movimientos_bancarios')
    .select('monto, estatus_conciliacion_id')
    .eq('id', movimientoId)
    .single();

  if (!mov) return;

  const { data: rels } = await supabaseAdmin
    .from('comprobantes_deposito_movimientos')
    .select('monto_asociado')
    .eq('movimiento_id', movimientoId);

  const totalComprobantes = rels?.reduce((acc, r) => acc + Number(r.monto_asociado), 0) || 0;
  const absMontoMov = Math.abs(Number(mov.monto));

  const { data: statusConciliado } = await supabaseAdmin
    .from('estatus_conciliacion_bancaria')
    .select('id')
    .eq('clave', 'conciliado')
    .single();

  const { data: statusParcial } = await supabaseAdmin
    .from('estatus_conciliacion_bancaria')
    .select('id')
    .eq('clave', 'parcial')
    .maybeSingle();

  const { data: statusPendiente } = await supabaseAdmin
    .from('estatus_conciliacion_bancaria')
    .select('id')
    .eq('clave', 'pendiente')
    .single();

  let targetStatusId = statusPendiente?.id;

  if (totalComprobantes > 0) {
    if (Math.abs(totalComprobantes - absMontoMov) < 0.05) {
      targetStatusId = statusConciliado?.id;
    } else {
      targetStatusId = statusParcial?.id || statusConciliado?.id;
    }
  }

  await supabaseAdmin
    .from('movimientos_bancarios')
    .update({ estatus_conciliacion_id: targetStatusId })
    .eq('id', movimientoId)
    .eq('empresa_id', empresaId);
}

// 18. FUSIONAR MOVIMIENTOS DE REEMBOLSO (INGRESO Y EGRESO CRUZADOS)
export async function fusionarMovimientosReembolso(
  movimientoId1: string,
  movimientoId2: string,
  payload: {
    soporteReembolsoUrl?: string | null;
    comentarios?: string | null;
    storageProvider?: 'Supabase' | 'GoogleDrive';
  },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // 1. Verificar ambos movimientos
    const { data: mov1, error: err1 } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('id', movimientoId1)
      .eq('empresa_id', empresaId)
      .single();

    const { data: mov2, error: err2 } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('id', movimientoId2)
      .eq('empresa_id', empresaId)
      .single();

    if (err1 || err2 || !mov1 || !mov2) {
      throw new Error('Uno o ambos movimientos no fueron encontrados.');
    }

    // Asegurarse de que uno es Depósito y otro es Retiro
    if (mov1.tipo_movimiento === mov2.tipo_movimiento) {
      throw new Error('Los movimientos a fusionar deben ser uno de depósito (+) y otro de retiro (-).');
    }

    // Obtener el ID del estatus "comprobado" (o "conciliado")
    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');
    const statusComprobadoId = catalog?.find((c) => c.clave === 'comprobado')?.id || 
                               catalog?.find((c) => c.clave === 'conciliado')?.id || null;

    // 2. Vincular y actualizar el movimiento 1
    const { error: upd1 } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({
        estatus_conciliacion_id: statusComprobadoId,
        soporte_reembolso_url: payload.soporteReembolsoUrl || null,
        comentarios: payload.comentarios || null,
        storage_provider: payload.storageProvider || 'Supabase',
        movimiento_reembolso_id: movimientoId2
      })
      .eq('id', movimientoId1)
      .eq('empresa_id', empresaId);

    if (upd1) throw upd1;

    // 3. Vincular y actualizar el movimiento 2
    const { error: upd2 } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({
        estatus_conciliacion_id: statusComprobadoId,
        soporte_reembolso_url: payload.soporteReembolsoUrl || null,
        comentarios: payload.comentarios || null,
        storage_provider: payload.storageProvider || 'Supabase',
        movimiento_reembolso_id: movimientoId1
      })
      .eq('id', movimientoId2)
      .eq('empresa_id', empresaId);

    if (upd2) throw upd2;

    return { success: true };
  } catch (err: any) {
    console.error('Error al fusionar movimientos:', err);
    return { success: false, error: err.message || 'Error al fusionar movimientos.' };
  }
}

// 12. OBTENER MOVIMIENTOS NO DEDUCIBLES DE MANERA ATEMPORAL (TODOS LOS MESES)
export async function obtenerMovimientosNoDeduciblesAtemporal(token: string): Promise<{
  success: boolean;
  movimientos?: any[];
  cierres?: any[];
  error?: string;
}> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // Obtener cierres mensuales
    const { data: cierres } = await supabaseAdmin
      .from('cierres_mensuales')
      .select('mes, estatus')
      .eq('empresa_id', empresaId);

    // Obtener movimientos bancarios atemporales (todos los meses)
    const { data: movimientos, error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select(`
        *,
        cuentas_bancarias(id, nombre),
        estatus_conciliacion_bancaria(id, clave, nombre, color),
        conciliaciones_bancarias(
          id, monto_asociado,
          gastos(id, concepto, monto, es_deducible, uuid_fiscal, xml_url, pdf_url, ticket_url, proveedores(nombre_comercial, rfc)),
          pedidos(id, numero_pedido, precio_total, clientes(nombre_local, rfc))
        )
      `)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      movimientos: movimientos || [],
      cierres: cierres || []
    };
  } catch (err: any) {
    console.error('Error fetching atemporal non-deductible movements:', err);
    return { success: false, error: err.message || 'Error al cargar movimientos no deducibles atemporales' };
  }
}




