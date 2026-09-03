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
    nombre: 'Pendiente',
    descripcion: 'Estado inicial. El movimiento no ha sido vinculado con ningún gasto, venta o documento.',
    color: '#9CA3AF',
    empresa_id: null
  },
  {
    clave: 'conciliado',
    nombre: 'Conciliado',
    descripcion: 'Match exacto: vinculado a gasto/venta con documentación soporte (XML, ticket, póliza).',
    color: '#10B981',
    empresa_id: null
  },
  {
    clave: 'parcial',
    nombre: 'Parcialmente Conciliado',
    descripcion: 'Tiene comprobantes o documentos asociados pero no cubren el 100% del monto.',
    color: '#3B82F6',
    empresa_id: null
  },
  {
    clave: 'no_facturable',
    nombre: 'No Facturable',
    descripcion: 'Comisiones bancarias, nóminas, impuestos, traspasos — conceptos que no generan CFDI deducible.',
    color: '#8B5CF6',
    empresa_id: null
  },
  {
    clave: 'no_deducible',
    nombre: 'No Deducible',
    descripcion: 'Debería tener factura para ser deducible pero no la tiene. Alerta fiscal.',
    color: '#EF4444',
    empresa_id: null
  },
  {
    clave: 'excluido',
    nombre: 'Excluido',
    descripcion: 'Movimiento ignorado: duplicado, error bancario o movimiento personal.',
    color: '#6B7280',
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
}import { esComisionTpv, esComisionBancaria } from './commissionUtils';

// 1. IMPORTAR MOVIMIENTOS BANCARIOS DESDE EXCEL / CSV
export async function importarMovimientosBancarios(
  movements: {
    fecha: string;
    concepto: string;
    retiro?: number | string;
    deposito?: number | string;
    referencia?: string;
    categoria?: string;
    categoria_movimiento_id?: string;
  }[],
  token: string,
  cuentaBancariaId?: string,
  nombreArchivo: string = 'Estado_de_cuenta.xlsx',
  cargaIdToReplace?: string,
  acumularComisiones: boolean = true,
  periodoAsignado?: string,
  defaultCategoriaId?: string
): Promise<{ success: boolean; count?: number; totalLeidos?: number; duplicadosOmitidos?: number; cargaId?: string; error?: string }> {
  try {
    await ensureBasicStatuses();
    const { empresaId } = await getUserEmpresaId(token);

    // Get Pendiente status ID
    const { data: statusPendiente } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'pendiente')
      .single();

    const { data: statusNoFacturable } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'no_facturable')
      .maybeSingle();

    const estatusId = statusPendiente?.id;
    const estatusNoFacturableId = statusNoFacturable?.id || estatusId;

    // Obtener catálogo de categorías de movimiento bancario
    const { data: catMovimientos } = await supabaseAdmin
      .from('categorias_movimiento_bancario')
      .select('id, clave, nombre, empresa_id');

    const normalizeCat = (txt?: string | null): string => {
      if (!txt) return '';
      return txt
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    const findCategoriaId = (catInput?: string | null, mConcepto?: string): string | null => {
      if (catInput) {
        const inputNorm = normalizeCat(catInput);
        if (inputNorm) {
          // 1. Coincidencia directa por ID
          const matchId = catMovimientos?.find(c => c.id === catInput);
          if (matchId) return matchId.id;

          // 2. Coincidencia exacta por Clave o Nombre normalizado
          const matchExact = catMovimientos?.find(c => 
            normalizeCat(c.clave) === inputNorm || normalizeCat(c.nombre) === inputNorm
          );
          if (matchExact) return matchExact.id;

          // 3. Coincidencias por palabras clave / alias comunes
          if (inputNorm.includes('proveedor') || inputNorm.includes('compra') || inputNorm.includes('gasto') || inputNorm.includes('egreso')) {
            const cat = catMovimientos?.find(c => c.clave === 'EGRESO_COMPRA' || normalizeCat(c.nombre).includes('proveedor'));
            if (cat) return cat.id;
          }
          if (inputNorm.includes('venta') || inputNorm.includes('cobro') || inputNorm.includes('cliente') || inputNorm.includes('ingreso')) {
            const cat = catMovimientos?.find(c => c.clave === 'INGRESO_VENTA' || normalizeCat(c.nombre).includes('venta'));
            if (cat) return cat.id;
          }
          if (inputNorm.includes('tpv') || inputNorm.includes('clip') || inputNorm.includes('parrot') || inputNorm.includes('mercadopago')) {
            const cat = catMovimientos?.find(c => c.clave === 'COMISION_TPV' || normalizeCat(c.nombre).includes('tpv'));
            if (cat) return cat.id;
          }
          if (inputNorm.includes('banco') || inputNorm.includes('bancaria') || inputNorm.includes('manejo') || inputNorm.includes('comision')) {
            const cat = catMovimientos?.find(c => c.clave === 'COMISION_BANCO' || normalizeCat(c.nombre).includes('banco') || normalizeCat(c.nombre).includes('comision'));
            if (cat) return cat.id;
          }
          if (inputNorm.includes('traspas') || inputNorm.includes('transferencia entre')) {
            const cat = catMovimientos?.find(c => c.clave === 'TRASPASO' || normalizeCat(c.nombre).includes('traspaso'));
            if (cat) return cat.id;
          }
          if (inputNorm.includes('prestamo') || inputNorm.includes('credito')) {
            const cat = catMovimientos?.find(c => c.clave === 'PRESTAMO' || normalizeCat(c.nombre).includes('prestamo'));
            if (cat) return cat.id;
          }
          if (inputNorm.includes('ajuste') || inputNorm.includes('redondeo')) {
            const cat = catMovimientos?.find(c => c.clave === 'AJUSTE' || normalizeCat(c.nombre).includes('ajuste'));
            if (cat) return cat.id;
          }

          // 4. Búsqueda por inclusión parcial en cualquier categoría del catálogo
          const matchPartial = catMovimientos?.find(c => 
            normalizeCat(c.nombre).includes(inputNorm) || inputNorm.includes(normalizeCat(c.nombre))
          );
          if (matchPartial) return matchPartial.id;
        }
      }

      // Si no se proporcionó categoría en la fila o no coincidió, usar la categoría por defecto si existe
      if (defaultCategoriaId) {
        return defaultCategoriaId;
      }

      // Si es comisión detectada automáticamente
      if (mConcepto && (esComisionTpv(mConcepto) || esComisionBancaria(mConcepto))) {
        if (esComisionTpv(mConcepto)) {
          const catTpv = catMovimientos?.find(c => c.clave === 'COMISION_TPV');
          if (catTpv) return catTpv.id;
        }
        const catBanco = catMovimientos?.find(c => c.clave === 'COMISION_BANCO');
        if (catBanco) return catBanco.id;
      }

      return null;
    };

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

    let formattedMovements = movements.map((m) => {
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
      const mesConciliacionFinal = (periodoAsignado && /^\d{4}-\d{2}$/.test(periodoAsignado.trim()))
        ? periodoAsignado.trim()
        : fechaFormatted.substring(0, 7);

      const matchedCatId = m.categoria_movimiento_id || findCategoriaId(m.categoria, m.concepto);

      return {
        fecha: fechaFormatted,
        concepto: m.concepto,
        retiro: r,
        deposito: d,
        monto: montoVal,
        tipo_movimiento: tipo,
        referencia: m.referencia || null,
        estatus_conciliacion_id: estatusId,
        categoria_movimiento_id: matchedCatId,
        rfc_proveedor: rfc,
        empresa_id: empresaId,
        cuenta_bancaria_id: targetCuentaId,
        mes_conciliacion: mesConciliacionFinal,
        visible_egresos: false,
        visible_ingresos: false,
        carga_id: null as string | null
      };
    });

    if (acumularComisiones) {
      // Auto-clasificar comisiones TPV y bancarias como No Facturable manteniendo cada registro individual separado
      formattedMovements = formattedMovements.map(m => {
        if (m.retiro > 0 && (esComisionTpv(m.concepto) || esComisionBancaria(m.concepto))) {
          return {
            ...m,
            estatus_conciliacion_id: estatusNoFacturableId
          };
        }
        return m;
      });
    }

    // Registrar o actualizar la carga_id usando la fecha real del documento o periodo asignado
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

    let minFecha = fechesSorted[0] || new Date().toISOString().substring(0, 10);
    const maxFecha = fechesSorted[fechesSorted.length - 1] || minFecha;
    const fechaDocumentoStr = minFecha === maxFecha ? minFecha : `${minFecha} al ${maxFecha}`;

    if (periodoAsignado && /^\d{4}-\d{2}$/.test(periodoAsignado.trim())) {
      const p = periodoAsignado.trim();
      // Si la fecha mínima no pertenece al periodo asignado, fijar fecha_carga al inicio del periodo asignado
      if (!minFecha.startsWith(p)) {
        minFecha = `${p}-01`;
      }
    }

    const notasFinales = `Fecha del documento: ${fechaDocumentoStr}${periodoAsignado ? ` | Período: ${periodoAsignado}` : ''}`;

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
          notas: notasFinales
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
          notas: notasFinales
        })
        .select('id')
        .maybeSingle();

      if (newCarga) {
        currentCargaId = newCarga.id;
      }
    }

    // Check for duplicates in the DB globally for this company (handling Supabase 1000-row limit)
    let existingMovements: {
      id: string;
      fecha: string;
      concepto: string;
      monto: number;
      retiro: number;
      deposito: number;
      referencia: string | null;
      cuenta_bancaria_id: string | null;
    }[] = [];

    let dbPage = 0;
    const CHUNK_SIZE = 1000;
    while (true) {
      const { data: chunk, error: fetchErr } = await supabaseAdmin
        .from('movimientos_bancarios')
        .select('id, fecha, concepto, monto, retiro, deposito, referencia, cuenta_bancaria_id')
        .eq('empresa_id', empresaId)
        .range(dbPage * CHUNK_SIZE, (dbPage + 1) * CHUNK_SIZE - 1);

      if (fetchErr) throw fetchErr;
      if (!chunk || chunk.length === 0) break;
      existingMovements = existingMovements.concat(chunk as any);
      if (chunk.length < CHUNK_SIZE) break;
      dbPage++;
    }

    const cleanRefHelper = (ref?: string | null): string => {
      if (!ref) return '';
      const r = String(ref).trim();
      const lower = r.toLowerCase();
      if (['', '0', '00', '000', '-', '--', 's/r', 's/n', 's/f', 'null', 'undefined', 'n/a', 'na', 'none'].includes(lower)) {
        return '';
      }
      return r;
    };

    const normalizeConceptHelper = (concepto?: string | null): string => {
      if (!concepto) return '';
      return String(concepto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // 1. Set of existing references in DB (case-insensitive)
    const existingRefMap = new Set<string>();
    // 2. Set of existing content keys: `${dateStr}|${conceptNormalized}|${amountFixed}`
    const existingContentKeys = new Set<string>();

    existingMovements.forEach((m) => {
      const cleanRef = cleanRefHelper(m.referencia).toLowerCase();
      const dateStr = (m.fecha || '').substring(0, 10);
      const conceptStr = normalizeConceptHelper(m.concepto);
      const amountVal = Number(m.monto || 0).toFixed(2);
      const depVal = Number(m.deposito || 0).toFixed(2);
      const retVal = Number(m.retiro || 0).toFixed(2);

      // Claves de contenido exacto en BD
      existingContentKeys.add(`${dateStr}|${conceptStr}|${amountVal}|${depVal}|${retVal}`);
      existingContentKeys.add(`${dateStr}|${conceptStr}|${amountVal}`);

      if (cleanRef) {
        // Para referencias cortas (números de consecutivo, lote), acotar a fecha y monto
        existingRefMap.add(`${dateStr}|${cleanRef}|${amountVal}`);
        // Solo para referencias largas (UUIDs, claves de rastreo SPEI de >= 12 caracteres), verificar globalmente
        if (cleanRef.length >= 12 && !/^\d+$/.test(cleanRef)) {
          existingRefMap.add(cleanRef);
        }
      }
    });

    // Filter to only new movements (matching against DB and preventing batch-internal duplicates)
    const batchRefs = new Set<string>();
    const batchContentKeys = new Set<string>();
    const newMovements: typeof formattedMovements = [];

    for (const m of formattedMovements) {
      const cleanRef = cleanRefHelper(m.referencia);
      const cleanRefLower = cleanRef.toLowerCase();
      const dateStr = (m.fecha || '').substring(0, 10);
      const conceptStr = normalizeConceptHelper(m.concepto);
      const amountVal = Number(m.monto || 0).toFixed(2);
      const depVal = Number(m.deposito || 0).toFixed(2);
      const retVal = Number(m.retiro || 0).toFixed(2);
      const contentKey = `${dateStr}|${conceptStr}|${amountVal}|${depVal}|${retVal}`;
      const fallbackKey = `${dateStr}|${conceptStr}|${amountVal}`;
      const refKey = `${dateStr}|${cleanRefLower}|${amountVal}`;

      // Regla 1: Si tiene referencia bancaria, verificar unicidad contra BD y contra el lote
      if (cleanRefLower) {
        const isLongUniqueRef = cleanRefLower.length >= 12 && !/^\d+$/.test(cleanRefLower);
        if (
          (isLongUniqueRef && (existingRefMap.has(cleanRefLower) || batchRefs.has(cleanRefLower))) ||
          existingRefMap.has(refKey) ||
          batchRefs.has(refKey)
        ) {
          // Ya existe un movimiento con esta misma referencia en la misma fecha y monto -> descartar duplicado
          continue;
        }
      }

      // Regla 2: Verificar si ya existe una transacción idéntica en fecha, concepto y monto
      if (
        existingContentKeys.has(contentKey) ||
        existingContentKeys.has(fallbackKey) ||
        batchContentKeys.has(contentKey) ||
        batchContentKeys.has(fallbackKey)
      ) {
        // Ya existe una transacción idéntica -> descartar duplicado
        continue;
      }

      // Registrar como aceptada en este lote
      if (cleanRefLower) {
        batchRefs.add(cleanRefLower);
        batchRefs.add(refKey);
      }
      batchContentKeys.add(contentKey);
      batchContentKeys.add(fallbackKey);

      newMovements.push({
        ...m,
        referencia: cleanRef || null,
        carga_id: currentCargaId || null
      });
    }

    if (newMovements.length === 0) {
      if (currentCargaId && !cargaIdToReplace) {
        await supabaseAdmin.from('cargas_estados_cuenta').delete().eq('id', currentCargaId);
      }
      return { 
        success: true, 
        count: 0, 
        totalLeidos: formattedMovements.length, 
        duplicadosOmitidos: formattedMovements.length,
        cargaId: undefined 
      };
    }

    const { data, error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .insert(newMovements)
      .select('id');

    if (error) throw error;

    // Actualizar conteos y montos reales de la carga con los registros efectivamente insertados
    if (currentCargaId) {
      let realDepositos = 0;
      let realRetiros = 0;
      newMovements.forEach(m => {
        if (m.deposito > 0) realDepositos += m.deposito;
        if (m.retiro > 0) realRetiros += m.retiro;
      });

      await supabaseAdmin
        .from('cargas_estados_cuenta')
        .update({
          total_registros: newMovements.length,
          total_depositos: realDepositos,
          total_retiros: realRetiros
        })
        .eq('id', currentCargaId);
    }

    return { 
      success: true, 
      count: data?.length || 0, 
      totalLeidos: formattedMovements.length,
      duplicadosOmitidos: formattedMovements.length - (data?.length || 0),
      cargaId: currentCargaId || undefined 
    };
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

      await supabaseAdmin
        .from('comprobantes_deposito_movimientos')
        .delete()
        .in('movimiento_id', movIds);

      await supabaseAdmin
        .from('movimientos_bancarios')
        .delete()
        .in('id', movIds)
        .eq('empresa_id', empresaId);
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
    const statusConciliado = getStatusId('conciliado');
    const statusParcial = getStatusId('parcial');
    const statusNoDeducible = getStatusId('no_deducible');

    // 1. Get bank movements for this company that are candidates (pendiente, no_deducible, or null)
    const statusFilter = ['estatus_conciliacion_id.is.null'];
    if (statusPendiente) statusFilter.push(`estatus_conciliacion_id.eq.${statusPendiente}`);
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
          const targetStatus = hasTicket ? statusConciliado : statusParcial;
          
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
          // Si no se encuentra coincidencia, dejar como pendiente
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({ estatus_conciliacion_id: statusPendiente })
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
          // Si no se encuentra coincidencia para depósito, dejar como pendiente
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({ estatus_conciliacion_id: statusPendiente })
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

export interface PropuestaConciliacionItem {
  id: string;
  tipo: 'retiro_gasto' | 'deposito_pedido' | 'retiro_efectivo';
  confianza: 'exacta' | 'alta' | 'media';
  motivoConfianza: string;
  movimiento: {
    id: string;
    fecha: string;
    concepto: string;
    monto: number;
    tipo_movimiento: 'Retiro' | 'Deposito';
    referencia?: string | null;
    cuenta_id?: string | null;
    cuenta_nombre?: string | null;
    cuenta_moneda?: string | null;
    rfc_proveedor?: string | null;
    xml_url?: string | null;
    pdf_factura_url?: string | null;
    pdf_ticket_url?: string | null;
    rawMovimiento?: any;
  };
  coincidencia?: {
    id: string;
    tipo: 'gasto' | 'pedido';
    proveedor_nombre?: string | null;
    proveedor_rfc?: string | null;
    cliente_nombre?: string | null;
    cliente_rfc?: string | null;
    folio_factura?: string | null;
    uuid_fiscal?: string | null;
    fecha_documento?: string | null;
    monto: number;
    metodo_pago?: string | null;
    forma_pago_nombre?: string | null;
    categoria_nombre?: string | null;
    concepto?: string | null;
    es_deducible?: boolean;
    xml_url?: string | null;
    pdf_url?: string | null;
    ticket_url?: string | null;
  };
  discrepancia?: {
    tieneDiscrepancia: boolean;
    detalle?: string;
  };
  diasDiferencia?: number;
  diferenciaMonto?: number;
  alternativas?: Array<{
    id: string;
    tipo: 'gasto' | 'pedido';
    nombre: string;
    rfc?: string | null;
    folio?: string | null;
    fecha?: string | null;
    monto: number;
    metodo_pago?: string | null;
  }>;
}

/**
 * Obtiene la lista de propuestas de auto-conciliación para que el usuario las revise
 * antes de aplicar los cambios en la base de datos.
 */
export async function obtenerPropuestasAutoConciliacion(
  token: string,
  cuentaId?: string | null,
  periodo?: string | null
): Promise<{ success: boolean; propuestas?: PropuestaConciliacionItem[]; error?: string }> {
  try {
    await ensureBasicStatuses();
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId || empresaId === 'null') {
      throw new Error('Empresa inválida o no asignada to user.');
    }

    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');

    const getStatusId = (clave: string) => catalog?.find((c) => c.clave === clave)?.id || null;
    const statusConciliado = getStatusId('conciliado');
    const statusExcluido = getStatusId('excluido');
    const statusNoFacturable = getStatusId('no_facturable');
    const statusPendiente = getStatusId('pendiente');

    // 1. Obtener movimientos pendientes de la empresa (solo pendientes o nulos)
    const statusFilter = ['estatus_conciliacion_id.is.null'];
    if (statusPendiente) statusFilter.push(`estatus_conciliacion_id.eq.${statusPendiente}`);

    let queryMovs = supabaseAdmin
      .from('movimientos_bancarios')
      .select('*, cuentas_bancarias(id, nombre, moneda, numero_cuenta), estatus_conciliacion_bancaria(id, clave, nombre)')
      .eq('empresa_id', empresaId)
      .or(statusFilter.join(','))
      .order('fecha', { ascending: true });

    if (cuentaId) {
      queryMovs = queryMovs.eq('cuenta_bancaria_id', cuentaId);
    }

    // Filtrar por el periodo (mes seleccionado, ej. '2026-08')
    if (periodo && /^\d{4}-\d{2}$/.test(periodo.trim())) {
      const pTrim = periodo.trim();
      const [yearStr, monthStr] = pTrim.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = `${pTrim}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${pTrim}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

      queryMovs = queryMovs.gte('fecha', startDate).lte('fecha', endDate);
    }

    const { data: movements, error: movsErr } = await queryMovs;
    if (movsErr) throw movsErr;
    if (!movements || movements.length === 0) {
      return { success: true, propuestas: [] };
    }

    // 2. Consultar relaciones y enlaces existentes en BD para excluir estrictamente todo lo ya conciliado
    const [existingConcsRes, existingCompMovsRes] = await Promise.all([
      supabaseAdmin
        .from('conciliaciones_bancarias')
        .select('movimiento_id, gasto_id, pedido_id')
        .eq('empresa_id', empresaId),
      supabaseAdmin
        .from('comprobantes_deposito_movimientos')
        .select('movimiento_id')
    ]);

    const concMovIdsSet = new Set<string>();
    const concGastoIdsSet = new Set<string>();
    const concPedidoIdsSet = new Set<string>();

    (existingConcsRes.data || []).forEach(c => {
      if (c.movimiento_id) concMovIdsSet.add(c.movimiento_id);
      if (c.gasto_id) concGastoIdsSet.add(c.gasto_id);
      if (c.pedido_id) concPedidoIdsSet.add(c.pedido_id);
    });

    (existingCompMovsRes.data || []).forEach(c => {
      if (c.movimiento_id) concMovIdsSet.add(c.movimiento_id);
    });

    // 3. Obtener gastos no asociados y no conciliados
    const { data: rawGastos } = await supabaseAdmin
      .from('gastos')
      .select('*, proveedores(id, nombre_comercial, razon_social, rfc), categorias_gasto(id, nombre), formas_pago(id, nombre, codigo)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null);

    const pendingGastos = (rawGastos || []).filter(g => !concGastoIdsSet.has(g.id));

    // 4. Obtener pedidos no asociados y no conciliados
    const { data: rawPedidos } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(id, nombre_local, razon_social, rfc), facturas_clientes(xml_url, pdf_url, ticket_url)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null);

    const pendingPedidos = (rawPedidos || []).filter(p => !concPedidoIdsSet.has(p.id) && p.estatus_pago !== 'Cancelado');

    const propuestas: PropuestaConciliacionItem[] = [];
    const usedGastoIds = new Set<string>();
    const usedPedidoIds = new Set<string>();

    for (const mov of movements) {
      if (concMovIdsSet.has(mov.id)) continue;
      if (
        mov.estatus_conciliacion_id === statusConciliado ||
        mov.estatus_conciliacion_id === statusExcluido ||
        mov.estatus_conciliacion_id === statusNoFacturable
      ) continue;
      if (
        mov.estatus_conciliacion_bancaria?.clave === 'conciliado' ||
        mov.estatus_conciliacion_bancaria?.clave === 'excluido' ||
        mov.estatus_conciliacion_bancaria?.clave === 'no_facturable'
      ) continue;

      const isCash = esMovimientoEfectivo(mov.concepto);
      const isRetiro = mov.tipo_movimiento === 'Retiro' || Number(mov.retiro || 0) > 0;
      const absMonto = Math.abs(Number(mov.monto || (isRetiro ? mov.retiro : mov.deposito) || 0));
      if (absMonto <= 0) continue;

      const movConceptoUpper = (mov.concepto || '').toUpperCase();
      const rfcEnConcepto = extraerRfcDeConcepto(mov.concepto) || (mov.rfc_proveedor ? mov.rfc_proveedor.toUpperCase() : null);

      if (isRetiro) {
        if (isCash) {
          const hasTicket = !!mov.pdf_ticket_url || !!mov.xml_url;
          propuestas.push({
            id: `${mov.id}___efectivo`,
            tipo: 'retiro_efectivo',
            confianza: 'alta',
            motivoConfianza: hasTicket ? 'Retiro en efectivo con comprobante/ticket' : 'Retiro/Disposición en efectivo en cajero',
            movimiento: {
              id: mov.id,
              fecha: mov.fecha,
              concepto: mov.concepto,
              monto: absMonto,
              tipo_movimiento: 'Retiro',
              referencia: mov.referencia,
              cuenta_id: mov.cuenta_bancaria_id,
              cuenta_nombre: mov.cuentas_bancarias?.nombre || 'Cuenta Bancaria',
              cuenta_moneda: mov.cuentas_bancarias?.moneda || 'MXN',
              rfc_proveedor: mov.rfc_proveedor,
              xml_url: mov.xml_url,
              pdf_factura_url: mov.pdf_factura_url,
              pdf_ticket_url: mov.pdf_ticket_url,
              rawMovimiento: mov
            },
            coincidencia: {
              id: `auto_gasto_efectivo_${mov.id}`,
              tipo: 'gasto',
              proveedor_nombre: 'Retiro en Efectivo / Caja',
              proveedor_rfc: 'EFECTIVO',
              folio_factura: 'S/F',
              fecha_documento: mov.fecha,
              monto: absMonto,
              metodo_pago: 'Efectivo (01)',
              forma_pago_nombre: 'Efectivo',
              categoria_nombre: 'Caja Chica / Efectivo',
              concepto: mov.concepto,
              es_deducible: hasTicket
            },
            diferenciaMonto: 0,
            diasDiferencia: 0
          });
          continue;
        }

        // Buscar coincidencia en gastos disponibles (Monto EXACTO únicamente)
        const candidateGastos = (pendingGastos || [])
          .filter(g => !usedGastoIds.has(g.id))
          .filter(g => {
            const gMonto = Number(g.monto || 0);
            if (gMonto <= 0) return false;
            // Coincidencia de importe EXACTO únicamente
            return Math.abs(gMonto - absMonto) < 0.05;
          })
          .sort((a, b) => {
            const getCandidateScore = (item: any) => {
              const rfc = (item.proveedores?.rfc || '').toUpperCase();
              const hasRfcMatch = rfcEnConcepto && rfc && rfcEnConcepto === rfc;

              const provName = (item.proveedores?.nombre_comercial || item.proveedores?.razon_social || '').toUpperCase();
              const hasNameMatch = provName.length > 3 && movConceptoUpper.includes(provName.substring(0, 8));

              const itemDate = parseDateOnly(item.fecha_gasto || item.fecha);
              const mDate = parseDateOnly(mov.fecha);
              const diffDays = itemDate && mDate ? Math.round((mDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24)) : 999;
              const absDays = Math.abs(diffDays);

              let score = 0;

              // 1. Coincidencia de RFC / Nombre (Máxima prioridad)
              if (hasRfcMatch) score += 1000;
              else if (hasNameMatch) score += 600;

              // 2. Proximidad de fecha (priorizar fechas cercanas pero sin descartar lejanas)
              if (absDays <= 3) score += 300;
              else if (absDays <= 15) score += 200;
              else if (absDays <= 30) score += 150;
              else if (absDays <= 60) score += 100;
              else if (absDays <= 180) score += 50;
              else score += 10; // Fechas lejanas

              return score;
            };

            return getCandidateScore(b) - getCandidateScore(a);
          });

        if (candidateGastos.length > 0) {
          const bestMatch = candidateGastos[0];
          usedGastoIds.add(bestMatch.id);

          const provRfc = (bestMatch.proveedores?.rfc || '').toUpperCase();
          const provNombre = bestMatch.proveedores?.nombre_comercial || bestMatch.proveedores?.razon_social || 'Proveedor sin nombre';
          const rfcExactMatch = !!(rfcEnConcepto && provRfc && rfcEnConcepto === provRfc);
          const nameMatch = provNombre.length > 3 && movConceptoUpper.includes(provNombre.substring(0, 8).toUpperCase());

          const gDate = parseDateOnly(bestMatch.fecha_gasto || bestMatch.fecha);
          const mDate = parseDateOnly(mov.fecha);
          const diffDays = gDate && mDate ? Math.round((mDate.getTime() - gDate.getTime()) / (1000 * 3600 * 24)) : 0;
          const absDays = Math.abs(diffDays);

          let confianza: 'exacta' | 'alta' | 'media' = 'media';
          let motivoConfianza = '';

          if (rfcExactMatch) {
            confianza = 'exacta';
            motivoConfianza = absDays <= 15 ? 'RFC y Monto coinciden exactamente' : `RFC y Monto exactos (Fecha: ${absDays}d)`;
          } else if (nameMatch) {
            confianza = 'alta';
            motivoConfianza = absDays <= 15 ? 'Proveedor y Monto coinciden' : `Proveedor y Monto exactos (Fecha: ${absDays}d)`;
          } else if (absDays <= 15) {
            confianza = 'alta';
            motivoConfianza = `Monto exacto ($${absMonto.toFixed(2)}) con fecha cercana (${absDays}d)`;
          } else {
            confianza = 'media';
            motivoConfianza = `Monto exacto ($${absMonto.toFixed(2)}) — Fecha lejana (${absDays} días)`;
          }

          const disc = detectarDiscrepanciaPago(mov.concepto, bestMatch.metodo_pago || bestMatch.formas_pago?.codigo);

          const alternativas = candidateGastos.slice(1).map(alt => ({
            id: alt.id,
            tipo: 'gasto' as const,
            nombre: alt.proveedores?.nombre_comercial || alt.proveedores?.razon_social || 'Proveedor',
            rfc: alt.proveedores?.rfc,
            folio: alt.folio_factura,
            fecha: alt.fecha_gasto || alt.fecha,
            monto: Number(alt.monto || 0),
            metodo_pago: alt.metodo_pago || alt.formas_pago?.nombre
          }));

          propuestas.push({
            id: `${mov.id}___${bestMatch.id}`,
            tipo: 'retiro_gasto',
            confianza,
            motivoConfianza,
            movimiento: {
              id: mov.id,
              fecha: mov.fecha,
              concepto: mov.concepto,
              monto: absMonto,
              tipo_movimiento: 'Retiro',
              referencia: mov.referencia,
              cuenta_id: mov.cuenta_bancaria_id,
              cuenta_nombre: mov.cuentas_bancarias?.nombre || 'Cuenta Bancaria',
              cuenta_moneda: mov.cuentas_bancarias?.moneda || 'MXN',
              rfc_proveedor: mov.rfc_proveedor,
              xml_url: mov.xml_url,
              pdf_factura_url: mov.pdf_factura_url,
              pdf_ticket_url: mov.pdf_ticket_url,
              rawMovimiento: mov
            },
            coincidencia: {
              id: bestMatch.id,
              tipo: 'gasto',
              proveedor_nombre: provNombre,
              proveedor_rfc: bestMatch.proveedores?.rfc || null,
              folio_factura: bestMatch.folio_factura || null,
              uuid_fiscal: bestMatch.uuid_fiscal || null,
              fecha_documento: bestMatch.fecha_gasto || bestMatch.fecha || null,
              monto: Number(bestMatch.monto || 0),
              metodo_pago: bestMatch.metodo_pago || bestMatch.formas_pago?.nombre || 'No especificado',
              forma_pago_nombre: bestMatch.formas_pago?.nombre || null,
              categoria_nombre: bestMatch.categorias_gasto?.nombre || null,
              concepto: bestMatch.concepto || null,
              es_deducible: bestMatch.es_deducible,
              xml_url: bestMatch.xml_url,
              pdf_url: bestMatch.pdf_url,
              ticket_url: bestMatch.ticket_url
            },
            discrepancia: disc,
            diasDiferencia: diffDays,
            diferenciaMonto: 0,
            alternativas: alternativas.length > 0 ? alternativas : undefined
          });
        }
      } else {
        // Depósito -> Buscar en Pedidos (Monto EXACTO únicamente)
        const candidatePedidos = (pendingPedidos || [])
          .filter(p => !usedPedidoIds.has(p.id))
          .filter(p => {
            const pMonto = Number(p.precio_total || 0);
            if (pMonto <= 0) return false;
            // Coincidencia de importe EXACTO únicamente
            return Math.abs(pMonto - absMonto) < 0.05;
          })
          .sort((a, b) => {
            const getCandidateScore = (item: any) => {
              const clientRfc = (item.clientes?.rfc || '').toUpperCase();
              const hasRfcMatch = rfcEnConcepto && clientRfc && rfcEnConcepto === clientRfc;

              const clientName = (item.clientes?.nombre_local || item.clientes?.razon_social || '').toUpperCase();
              const hasNameMatch = clientName.length > 3 && movConceptoUpper.includes(clientName.substring(0, 8));

              const itemDate = parseDateOnly(item.fecha_pedido || item.creado_en);
              const mDate = parseDateOnly(mov.fecha);
              const diffDays = itemDate && mDate ? Math.round((mDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24)) : 999;
              const absDays = Math.abs(diffDays);

              let score = 0;

              // 1. Coincidencia de Cliente
              if (hasRfcMatch) score += 1000;
              else if (hasNameMatch) score += 600;

              // 2. Proximidad de fecha
              if (absDays <= 3) score += 300;
              else if (absDays <= 15) score += 200;
              else if (absDays <= 30) score += 150;
              else if (absDays <= 60) score += 100;
              else if (absDays <= 180) score += 50;
              else score += 10;

              return score;
            };

            return getCandidateScore(b) - getCandidateScore(a);
          });

        if (candidatePedidos.length > 0) {
          const bestMatch = candidatePedidos[0];
          usedPedidoIds.add(bestMatch.id);

          const clientNombre = bestMatch.clientes?.nombre_local || bestMatch.clientes?.razon_social || `Pedido #${bestMatch.numero_pedido}`;
          const clientRfc = bestMatch.clientes?.rfc || null;
          const matchClient = clientNombre.length > 3 && movConceptoUpper.includes(clientNombre.substring(0, 8).toUpperCase());

          const pDate = parseDateOnly(bestMatch.fecha_pedido || bestMatch.creado_en);
          const mDate = parseDateOnly(mov.fecha);
          const diffDays = pDate && mDate ? Math.round((mDate.getTime() - pDate.getTime()) / (1000 * 3600 * 24)) : 0;
          const absDays = Math.abs(diffDays);

          let confianza: 'exacta' | 'alta' | 'media' = 'media';
          let motivoConfianza = '';

          if (matchClient) {
            confianza = 'exacta';
            motivoConfianza = absDays <= 15 ? 'Cliente y Monto coinciden' : `Cliente y Monto exactos (Fecha: ${absDays}d)`;
          } else if (absDays <= 15) {
            confianza = 'alta';
            motivoConfianza = `Monto exacto ($${absMonto.toFixed(2)}) con fecha cercana (${diffDays} días)`;
          } else {
            confianza = 'media';
            motivoConfianza = `Monto exacto ($${absMonto.toFixed(2)}) — Fecha lejana (${absDays} días)`;
          }

          const factFiles = Array.isArray(bestMatch.facturas_clientes) && bestMatch.facturas_clientes.length > 0
            ? bestMatch.facturas_clientes[0]
            : null;

          const alternativas = candidatePedidos.slice(1).map(alt => ({
            id: alt.id,
            tipo: 'pedido' as const,
            nombre: alt.clientes?.nombre_local || `Pedido #${alt.numero_pedido}`,
            rfc: alt.clientes?.rfc,
            folio: alt.folio_factura || `Ped #${alt.numero_pedido}`,
            fecha: alt.fecha_pedido || alt.creado_en,
            monto: Number(alt.precio_total || 0),
            metodo_pago: 'Transferencia/Depósito'
          }));

          propuestas.push({
            id: `${mov.id}___${bestMatch.id}`,
            tipo: 'deposito_pedido',
            confianza,
            motivoConfianza,
            movimiento: {
              id: mov.id,
              fecha: mov.fecha,
              concepto: mov.concepto,
              monto: absMonto,
              tipo_movimiento: 'Deposito',
              referencia: mov.referencia,
              cuenta_id: mov.cuenta_bancaria_id,
              cuenta_nombre: mov.cuentas_bancarias?.nombre || 'Cuenta Bancaria',
              cuenta_moneda: mov.cuentas_bancarias?.moneda || 'MXN',
              rfc_proveedor: null,
              xml_url: mov.xml_url,
              pdf_factura_url: mov.pdf_factura_url,
              pdf_ticket_url: mov.pdf_ticket_url,
              rawMovimiento: mov
            },
            coincidencia: {
              id: bestMatch.id,
              tipo: 'pedido',
              cliente_nombre: clientNombre,
              cliente_rfc: clientRfc,
              folio_factura: bestMatch.folio_factura || `Pedido #${bestMatch.numero_pedido}`,
              fecha_documento: bestMatch.fecha_pedido || bestMatch.creado_en || null,
              monto: Number(bestMatch.precio_total || 0),
              metodo_pago: 'Depósito / Transferencia',
              concepto: `Pedido #${bestMatch.numero_pedido}`,
              xml_url: factFiles?.xml_url,
              pdf_url: factFiles?.pdf_url,
              ticket_url: factFiles?.ticket_url
            },
            diasDiferencia: diffDays,
            diferenciaMonto: 0,
            alternativas: alternativas.length > 0 ? alternativas : undefined
          });
        }
      }
    }

    return { success: true, propuestas };
  } catch (err: any) {
    console.error('Error al obtener propuestas de auto-conciliación:', err);
    return { success: false, error: err.message || 'Error al obtener propuestas de conciliación' };
  }
}

/**
 * Aplica en lote las propuestas de auto-conciliación seleccionadas por el usuario.
 */
export async function aplicarPropuestasConciliacion(
  propuestasSeleccionadas: PropuestaConciliacionItem[],
  token: string
): Promise<{ success: boolean; appliedCount: number; error?: string }> {
  try {
    if (!propuestasSeleccionadas || propuestasSeleccionadas.length === 0) {
      return { success: true, appliedCount: 0 };
    }

    await ensureBasicStatuses();
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId || empresaId === 'null') {
      throw new Error('Empresa inválida o no asignada to user.');
    }

    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');

    const getStatusId = (clave: string) => catalog?.find((c) => c.clave === clave)?.id || null;
    const statusConciliado = getStatusId('conciliado');
    const statusParcial = getStatusId('parcial');
    const statusNoDeducible = getStatusId('no_deducible');

    let appliedCount = 0;

    for (const prop of propuestasSeleccionadas) {
      const movId = prop.movimiento.id;
      const absMonto = Math.abs(prop.movimiento.monto);

      if (prop.tipo === 'retiro_efectivo') {
        const hasTicket = !!prop.movimiento.pdf_ticket_url || !!prop.movimiento.xml_url;
        const targetStatus = hasTicket ? statusConciliado : statusParcial;

        await supabaseAdmin
          .from('movimientos_bancarios')
          .update({
            estatus_conciliacion_id: targetStatus,
            visible_egresos: true
          })
          .eq('id', movId)
          .eq('empresa_id', empresaId);

        const { data: existingGasto } = await supabaseAdmin
          .from('gastos')
          .select('id')
          .eq('movimiento_bancario_id', movId)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (!existingGasto) {
          await supabaseAdmin.from('gastos').insert({
            fecha_gasto: prop.movimiento.fecha,
            concepto: prop.movimiento.concepto,
            monto: absMonto,
            metodo_pago: 'Efectivo',
            movimiento_bancario_id: movId,
            estatus_facturado: hasTicket,
            empresa_id: empresaId
          });
        }

        appliedCount++;
        continue;
      }

      if (prop.tipo === 'retiro_gasto' && prop.coincidencia) {
        const gastoId = prop.coincidencia.id;
        const disc = prop.discrepancia || { tieneDiscrepancia: false };
        const targetStatusId = disc.tieneDiscrepancia ? (statusNoDeducible || statusConciliado) : statusConciliado;

        const xmlToSet = prop.movimiento.xml_url || prop.coincidencia.xml_url || null;
        const pdfToSet = prop.movimiento.pdf_factura_url || prop.coincidencia.pdf_url || null;
        const ticketToSet = prop.movimiento.pdf_ticket_url || prop.coincidencia.ticket_url || null;

        await supabaseAdmin
          .from('gastos')
          .update({
            movimiento_bancario_id: movId,
            estatus_facturado: true,
            ...(disc.tieneDiscrepancia ? { es_deducible: false } : {}),
            ...(xmlToSet ? { xml_url: xmlToSet } : {}),
            ...(pdfToSet ? { pdf_url: pdfToSet } : {}),
            ...(ticketToSet ? { ticket_url: ticketToSet } : {})
          })
          .eq('id', gastoId)
          .eq('empresa_id', empresaId);

        // Delete any existing junction
        await supabaseAdmin
          .from('conciliaciones_bancarias')
          .delete()
          .eq('movimiento_id', movId)
          .eq('empresa_id', empresaId);

        await supabaseAdmin.from('conciliaciones_bancarias').insert({
          movimiento_id: movId,
          gasto_id: gastoId,
          monto_asociado: absMonto,
          empresa_id: empresaId
        });

        await supabaseAdmin
          .from('movimientos_bancarios')
          .update({
            estatus_conciliacion_id: targetStatusId,
            visible_egresos: true,
            xml_url: xmlToSet,
            pdf_factura_url: pdfToSet,
            pdf_ticket_url: ticketToSet
          })
          .eq('id', movId)
          .eq('empresa_id', empresaId);

        appliedCount++;
        continue;
      }

      if (prop.tipo === 'deposito_pedido' && prop.coincidencia) {
        const pedidoId = prop.coincidencia.id;

        await supabaseAdmin
          .from('pedidos')
          .update({
            movimiento_bancario_id: movId,
            estatus_pago: 'Liquidado'
          })
          .eq('id', pedidoId)
          .eq('empresa_id', empresaId);

        // Delete any existing junction
        await supabaseAdmin
          .from('conciliaciones_bancarias')
          .delete()
          .eq('movimiento_id', movId)
          .eq('empresa_id', empresaId);

        await supabaseAdmin.from('conciliaciones_bancarias').insert({
          movimiento_id: movId,
          pedido_id: pedidoId,
          monto_asociado: absMonto,
          empresa_id: empresaId
        });

        const xmlToSet = prop.movimiento.xml_url || prop.coincidencia.xml_url || null;
        const pdfToSet = prop.movimiento.pdf_factura_url || prop.coincidencia.pdf_url || null;
        const ticketToSet = prop.movimiento.pdf_ticket_url || prop.coincidencia.ticket_url || null;

        await supabaseAdmin
          .from('movimientos_bancarios')
          .update({
            estatus_conciliacion_id: statusConciliado,
            visible_ingresos: true,
            xml_url: xmlToSet,
            pdf_factura_url: pdfToSet,
            pdf_ticket_url: ticketToSet
          })
          .eq('id', movId)
          .eq('empresa_id', empresaId);

        appliedCount++;
        continue;
      }
    }

    return { success: true, appliedCount };
  } catch (err: any) {
    console.error('Error aplicando propuestas de conciliación:', err);
    return { success: false, appliedCount: 0, error: err.message || 'Error al aplicar las propuestas seleccionadas' };
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
                  const emisor = cfdi['cfdi:Emisor'] || cfdi['Emisor'];
                  const rfcEmisor = (emisor?.['@_Rfc'] || emisor?.['@_rfc'] || '').trim().toUpperCase();
                  const nombreEmisor = emisor?.['@_Nombre'] || emisor?.['@_nombre'];

                  // Validación por RFC de la empresa activa
                  if (empresaId) {
                    const { data: empData } = await supabaseAdmin
                      .from('empresas')
                      .select('rfc')
                      .eq('id', empresaId)
                      .maybeSingle();

                    const currentEmpresaRfc = empData?.rfc?.trim().toUpperCase();

                    // CASO A: Si el EMISOR es la empresa activa, es una FACTURA EMITIDA (Venta / Ingreso)
                    if (currentEmpresaRfc && rfcEmisor === currentEmpresaRfc) {
                      const { data: existingFc } = await supabaseAdmin
                        .from('facturas_clientes')
                        .select('id')
                        .eq('uuid_fiscal', uuid.toLowerCase())
                        .maybeSingle();

                      if (!existingFc) {
                        let clienteId = null;
                        if (rfcReceptor) {
                          const cleanRec = rfcReceptor.trim().toUpperCase();
                          let { data: cli } = await supabaseAdmin
                            .from('clientes')
                            .select('id')
                            .eq('rfc', cleanRec)
                            .eq('empresa_id', empresaId)
                            .maybeSingle();

                          if (!cli) {
                            const nombreRec = receptor?.['@_Nombre'] || receptor?.['@_nombre'] || `CLIENTE ${cleanRec}`;
                            const { data: newCli } = await supabaseAdmin
                              .from('clientes')
                              .insert({
                                rfc: cleanRec,
                                nombre_local: nombreRec,
                                razon_social: nombreRec,
                                empresa_id: empresaId,
                                es_anonimo: false
                              })
                              .select('id')
                              .single();
                            cli = newCli;
                          }
                          clienteId = cli?.id || null;
                        }

                        const totalV = parseFloat(cfdi['@_Total'] || cfdi['@_total'] || '0');
                        const subtotalV = parseFloat(cfdi['@_SubTotal'] || cfdi['@_subtotal'] || '0') || totalV;
                        const fechaV = cfdi['@_Fecha'] || cfdi['@_fecha'] || '';
                        const fechaEmisionV = fechaV ? fechaV.split('T')[0] : new Date().toISOString().split('T')[0];
                        const serieV = (cfdi['@_Serie'] || cfdi['@_serie'] || '').trim();
                        const folioV = (cfdi['@_Folio'] || cfdi['@_folio'] || '').trim();
                        const folioStrV = folioV ? `${serieV}${folioV}` : serieV || 'FAC';
                        const formaPagoCodeV = (cfdi['@_FormaPago'] || cfdi['@_formaPago'] || '').trim();

                        const { data: fpList } = await supabaseAdmin
                          .from('formas_pago')
                          .select('id')
                          .eq('codigo', formaPagoCodeV)
                          .limit(1);

                        const { data: estList } = await supabaseAdmin
                          .from('estatus_factura')
                          .select('id')
                          .ilike('nombre', 'Facturado')
                          .limit(1);

                        let globalIvaV = 0;
                        const impV = cfdi['cfdi:Impuestos'] || cfdi['Impuestos'];
                        const trasV = impV?.['cfdi:Traslados']?.['cfdi:Traslado'] || impV?.['Traslados']?.['Traslado'];
                        if (trasV) {
                          const trasArrV = Array.isArray(trasV) ? trasV : [trasV];
                          for (const t of trasArrV) {
                            if (t['@_Impuesto'] === '002') globalIvaV += parseFloat(t['@_Importe'] || '0');
                          }
                        }

                        await supabaseAdmin
                          .from('facturas_clientes')
                          .insert({
                            empresa_id: empresaId,
                            cliente_id: clienteId,
                            uuid_fiscal: uuid.toLowerCase(),
                            serie_folio: folioStrV,
                            total: totalV,
                            subtotal: subtotalV,
                            iva_trasladado: globalIvaV,
                            fecha_emision: fechaEmisionV,
                            forma_pago_id: fpList?.[0]?.id || null,
                            estatus_factura_id: estList?.[0]?.id || null,
                            uso_cfdi_clave: receptor?.['@_UsoCFDI'] || 'G03',
                            xml_url: path,
                            pdf_url: payload.pdfFacturaUrl || null
                          });
                      }
                      continue;
                    }

                    // CASO B: Si es un gasto (egreso), validar que el RECEPTOR sea la empresa activa
                    if (currentEmpresaRfc && rfcReceptor && rfcReceptor.trim().toUpperCase() !== currentEmpresaRfc) {
                      console.warn(`Saltando registro automático de gasto: RFC receptor del XML (${rfcReceptor}) no coincide con el RFC de la empresa activa (${currentEmpresaRfc}).`);
                      continue;
                    }
                  }

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
      const cleanPedidosIds = payload.pedidosIds.map(id => id.replace(/^suelta_/, ''));
      const { error: linkErr } = await supabaseAdmin
        .from('pedidos')
        .update({ movimiento_bancario_id: primaryMovId, estatus_pago: 'Liquidado' })
        .in('id', cleanPedidosIds)
        .eq('empresa_id', empresaId);

      if (linkErr) throw linkErr;

      const rawPedidosIds = payload.pedidosIds.map(id => id.replace(/^suelta_/, ''));

      const { data: pedidosInfo } = await supabaseAdmin
        .from('pedidos')
        .select('id, precio_total, folio_factura')
        .in('id', rawPedidosIds)
        .eq('empresa_id', empresaId);

      const foliosFromPedidos = (pedidosInfo || [])
        .map(p => p.folio_factura)
        .filter(Boolean);

      const { data: pedidosFiles } = await supabaseAdmin
        .from('facturas_clientes')
        .select('xml_url, pdf_url, ticket_url')
        .eq('empresa_id', empresaId)
        .or(`pedido_id.in.(${rawPedidosIds.join(',')}),id.in.(${rawPedidosIds.join(',')})${foliosFromPedidos.length > 0 ? `,serie_folio.in.(${foliosFromPedidos.map(f => `"${f}"`).join(',')})` : ''}`);

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
          const cleanPid = pId.replace(/^suelta_/, '');
          const pInfo = pedidosInfo?.find((p) => p.id === cleanPid);

          if (pInfo) {
            const { data: priorConcs } = await supabaseAdmin
              .from('conciliaciones_bancarias')
              .select('monto_asociado')
              .eq('pedido_id', cleanPid)
              .neq('movimiento_id', mItem.id);

            const totalPrior = (priorConcs || []).reduce((s, c) => s + Number(c.monto_asociado || 0), 0);
            const totalPedido = Number(pInfo.precio_total || 0);
            const saldoPendiente = Math.max(0, totalPedido - totalPrior);

            const montoAsoc = targetMovIds.length > 1
              ? movMonto
              : (saldoPendiente > 0 ? Math.min(movMonto, saldoPendiente) : movMonto);

            junctionEntries.push({
              movimiento_id: mItem.id,
              pedido_id: cleanPid,
              monto_asociado: montoAsoc,
              empresa_id: empresaId
            });
          } else {
            // Es una factura suelta (facturas_clientes)
            await supabaseAdmin
              .from('facturas_clientes')
              .update({ movimiento_bancario_id: mItem.id })
              .eq('id', cleanPid)
              .eq('empresa_id', empresaId);
          }
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
        targetStatusClave = 'conciliado';
      } else if (isCash) {
        targetStatusClave = hasTicket ? 'conciliado' : 'parcial';
      } else {
        const hasInvoice = (primaryMov.tipo_movimiento === 'Deposito') || (payload.gastosIds.length > 0);
        if (!hasInvoice) {
          targetStatusClave = 'no_deducible';
        } else if (hasXml) {
          targetStatusClave = 'conciliado';
        } else {
          targetStatusClave = 'parcial';
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
    if (payload.pdfTicketUrl === 'no_lleva') {
      updatePayload.pdf_ticket_url = 'no_lleva';
    } else {
      updatePayload.pdf_ticket_url = mergeUrls(payload.pdfTicketUrl, associatedTicket, primaryMov.pdf_ticket_url);
      if (updatePayload.pdf_ticket_url && updatePayload.pdf_ticket_url.includes('no_lleva') && updatePayload.pdf_ticket_url !== 'no_lleva') {
        updatePayload.pdf_ticket_url = updatePayload.pdf_ticket_url.split(',').filter((x: string) => x !== 'no_lleva').join(',');
      }
    }
    updatePayload.soporte_reembolso_url = mergeUrls(payload.soporteReembolsoUrl, primaryMov.soporte_reembolso_url);
    if (payload.storageProvider !== undefined) updatePayload.storage_provider = payload.storageProvider;

    if (payload.pdfTicketUrl === 'no_lleva' && payload.gastosIds && payload.gastosIds.length > 0) {
      await supabaseAdmin
        .from('gastos')
        .update({ ticket_url: 'no_lleva' })
        .in('id', payload.gastosIds)
        .eq('empresa_id', empresaId);
    }

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
  updates: { fecha: string; concepto: string; retiro: number; deposito: number; categoria_movimiento_id?: string | null },
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

    const updatePayload: any = {
      fecha: updates.fecha,
      concepto: updates.concepto,
      retiro: Math.abs(updates.retiro),
      deposito: Math.abs(updates.deposito),
      monto: monto,
      tipo_movimiento,
      rfc_proveedor: rfc
    };

    if (updates.categoria_movimiento_id !== undefined) {
      updatePayload.categoria_movimiento_id = updates.categoria_movimiento_id;
    }

    const { error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update(updatePayload)
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

    // 3. Obtener el estatus 'conciliado'
    const { data: statusConciliado } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'conciliado')
      .single();

    if (!statusConciliado) throw new Error('Estatus de conciliación "conciliado" no encontrado.');

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
    const p: any = payload;
    
    const montoDebito = Number(p.monto_debito ?? p.montoDebito ?? 0);
    const montoCredito = Number(p.monto_credito ?? p.montoCredito ?? 0);
    const propinaDebito = Number(p.propina_debito ?? p.propinaDebito ?? 0);
    const propinaCredito = Number(p.propina_credito ?? p.propinaCredito ?? 0);
    const montoAmex = Number(p.monto_amex ?? p.montoAmex ?? 0);
    const propinaAmex = Number(p.propina_amex ?? p.propinaAmex ?? 0);
    const montoEfectivo = Number(p.monto_efectivo ?? p.montoEfectivo ?? 0);
    const propinaEfectivo = Number(p.propina_efectivo ?? p.propinaEfectivo ?? 0);
    const montoParrotpay = Number(p.monto_parrotpay ?? p.montoParrotpay ?? 0);
    const propinaParrotpay = Number(p.propina_parrotpay ?? p.propinaParrotpay ?? 0);

    const calculatedTotal = montoDebito + montoCredito + propinaDebito + propinaCredito +
      montoAmex + propinaAmex + montoEfectivo + propinaEfectivo + montoParrotpay + propinaParrotpay;

    const montoFinal = Number(p.monto) > 0 ? Number(p.monto) : calculatedTotal;

    const insertPayload: any = {
      tipo: p.tipo || 'corte_tarjeta',
      fecha: p.fecha,
      monto: montoFinal,
      descripcion: p.descripcion || null,
      archivo_url: p.archivo_url || p.archivoUrl || null,
      storage_provider: p.storage_provider || p.storageProvider || 'Supabase',
      cuenta_bancaria_id: p.cuenta_bancaria_id || p.cuentaBancariaId || null,
      empresa_id: empresaId,
      monto_debito: montoDebito,
      monto_credito: montoCredito,
      propina_debito: propinaDebito,
      propina_credito: propinaCredito,
      monto_amex: montoAmex,
      propina_amex: propinaAmex,
      monto_efectivo: montoEfectivo,
      monto_parrotpay: montoParrotpay,
      propina_efectivo: propinaEfectivo,
      propina_parrotpay: propinaParrotpay,
      comision_transacciones: Number(p.comision_transacciones ?? p.comisionTransacciones ?? 0),
      iva_transacciones: Number(p.iva_transacciones ?? p.ivaTransacciones ?? 0),
      otros_cargos: Number(p.otros_cargos ?? p.otrosCargos ?? 0)
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
      fecha: payload.fecha ? String(payload.fecha).substring(0, 10) : payload.fecha,
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

export async function eliminarMultiplesComprobantes(ids: string[], token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    for (const id of ids) {
      await removeCajaChicaForComprobante(id, empresaId);
    }
    const { error } = await supabaseAdmin
      .from('comprobantes_deposito')
      .delete()
      .in('id', ids)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in eliminarMultiplesComprobantes:', err);
    return { success: false, error: err.message || 'Error al eliminar comprobantes en lote.' };
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
      .eq('clave', 'conciliado')
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
        visible_ingresos: true,
        visible_egresos: false
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

    await supabaseAdmin
      .from('movimientos_bancarios')
      .update({ visible_egresos: false, visible_ingresos: true })
      .ilike('referencia', 'COMPROBANTE_DEPOSITO_%')
      .eq('empresa_id', empresaId);

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

    // Obtener el ID del estatus "conciliado"
    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');
    const statusConciliadoId = catalog?.find((c) => c.clave === 'conciliado')?.id || null;

    // 2. Vincular y actualizar el movimiento 1
    const { error: upd1 } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({
        estatus_conciliacion_id: statusConciliadoId,
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
        estatus_conciliacion_id: statusConciliadoId,
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

// 13. CONSOLIDAR COMISIONES TPV Y BANCARIAS EXISTENTES EN UN SOLO REGISTRO SEPARADO
export async function consolidarComisionesExistentes(
  token: string,
  cuentaBancariaId?: string | null,
  mesConciliacion?: string | null
): Promise<{ success: boolean; countConsolidated?: number; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: statusNoFacturable } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'no_facturable')
      .maybeSingle();

    const { data: statusPendiente } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'pendiente')
      .maybeSingle();

    const noFacturableId = statusNoFacturable?.id || statusPendiente?.id;

    let query = supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('tipo_movimiento', 'Retiro');

    if (cuentaBancariaId) {
      query = query.eq('cuenta_bancaria_id', cuentaBancariaId);
    }
    if (mesConciliacion) {
      query = query.eq('mes_conciliacion', mesConciliacion);
    }

    const { data: movs, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!movs || movs.length === 0) {
      return { success: true, countConsolidated: 0 };
    }

    const unlinkedMovs = movs.filter((m) => {
      const isAlreadyAcum = (m.concepto || '').startsWith('Total de comisiones');
      return !isAlreadyAcum;
    });

    const tpvMovs = unlinkedMovs.filter((m) => esComisionTpv(m.concepto));
    const bancoMovs = unlinkedMovs.filter((m) => esComisionBancaria(m.concepto));

    let consolidatedCount = 0;

    const processGroup = async (group: typeof movs, label: string, refPrefix: string) => {
      if (group.length <= 1) return;

      const idsToDelete = group.map((g) => g.id);
      const totalRetiro = group.reduce((sum, g) => sum + Math.abs(Number(g.retiro || g.monto || 0)), 0);
      const firstMov = group[0];

      await supabaseAdmin.from('conciliaciones_bancarias').delete().in('movimiento_id', idsToDelete);
      await supabaseAdmin.from('gastos').update({ movimiento_bancario_id: null }).in('movimiento_bancario_id', idsToDelete);
      await supabaseAdmin.from('movimientos_bancarios').delete().in('id', idsToDelete);

      await supabaseAdmin.from('movimientos_bancarios').insert({
        fecha: firstMov.fecha,
        concepto: `Total de comisiones ${label} (${group.length} movimientos)`,
        retiro: totalRetiro,
        deposito: 0,
        monto: -totalRetiro,
        tipo_movimiento: 'Retiro',
        referencia: `ACUM-${refPrefix}`,
        estatus_conciliacion_id: noFacturableId,
        empresa_id: empresaId,
        cuenta_bancaria_id: firstMov.cuenta_bancaria_id,
        mes_conciliacion: firstMov.mes_conciliacion || firstMov.fecha?.substring(0, 7),
        visible_egresos: false,
        visible_ingresos: false
      });

      consolidatedCount += group.length;
    };

    await processGroup(tpvMovs, 'TPV', 'TPV');
    await processGroup(bancoMovs, 'bancarias', 'BANCO');

    return { success: true, countConsolidated: consolidatedCount };
  } catch (err: any) {
    console.error('Error al consolidar comisiones:', err);
    return { success: false, error: err.message || 'Error al consolidar comisiones' };
  }
}

// ---------------------------------------------------------------------------
// MEJORAS DE CONCILIACIÓN BANCARIA (REGLAS Y SUGERENCIAS EN LOTE)
// ---------------------------------------------------------------------------

export async function obtenerReglasConciliacion(token: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { data, error } = await supabaseAdmin
      .from('reglas_conciliacion')
      .select('*, categorias_movimiento_bancario(nombre), estatus_conciliacion_bancaria(nombre), cuentas_contables(codigo, nombre)')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function guardarReglaConciliacion(token: string, regla: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const payload = {
      empresa_id: empresaId,
      nombre: regla.nombre,
      concepto_contiene: regla.concepto_contiene || null,
      monto_min: regla.monto_min ? Number(regla.monto_min) : null,
      monto_max: regla.monto_max ? Number(regla.monto_max) : null,
      cuenta_bancaria_id: regla.cuenta_bancaria_id || null,
      rfc_proveedor: regla.rfc_proveedor || null,
      es_comision: !!regla.es_comision,
      categoria_movimiento_id: regla.categoria_movimiento_id || null,
      estatus_conciliacion_id: regla.estatus_conciliacion_id || null,
      cuenta_contable_id: regla.cuenta_contable_id || null,
      es_deducible: regla.es_deducible !== undefined ? !!regla.es_deducible : true,
      activa: regla.activa !== undefined ? !!regla.activa : true,
      orden: regla.orden ? Number(regla.orden) : 10
    };

    if (regla.id) {
      const { error } = await supabaseAdmin.from('reglas_conciliacion').update(payload).eq('id', regla.id).eq('empresa_id', empresaId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('reglas_conciliacion').insert(payload);
      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function eliminarReglaConciliacion(token: string, reglaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { error } = await supabaseAdmin.from('reglas_conciliacion').delete().eq('id', reglaId).eq('empresa_id', empresaId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function sugerirConciliaciones(token: string, periodo: string): Promise<{ success: boolean; sugerencias?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // Cargar movimientos pendientes del periodo
    const { data: movs } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*, estatus_conciliacion_bancaria(clave, nombre)')
      .eq('empresa_id', empresaId)
      .gte('fecha', `${periodo}-01`)
      .lte('fecha', `${periodo}-31`);

    const pendMovs = (movs || []).filter(m => !m.estatus_conciliacion_bancaria || m.estatus_conciliacion_bancaria.clave === 'pendiente');

    // Cargar gastos sin conciliar
    const { data: gastos } = await supabaseAdmin
      .from('gastos')
      .select('*, proveedores(nombre_comercial, rfc)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null)
      .gte('fecha_gasto', `${periodo}-01`)
      .lte('fecha_gasto', `${periodo}-31`);

    // Cargar pedidos liquidados sin conciliar
    const { data: pedidos } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(nombre_local, rfc)')
      .eq('empresa_id', empresaId)
      .eq('estatus_pago', 'Liquidado')
      .is('movimiento_bancario_id', null)
      .gte('fecha_pedido', `${periodo}-01`)
      .lte('fecha_pedido', `${periodo}-31`);

    const sugerencias: any[] = [];

    for (const mov of pendMovs) {
      const movMonto = Math.abs(Number(mov.deposito || mov.retiro || mov.monto || 0));
      if (movMonto <= 0) continue;

      const movFecha = new Date(mov.fecha);

      // Si es retiro, buscar en Gastos
      if (mov.tipo_movimiento === 'Retiro' || Number(mov.retiro || 0) > 0) {
        const candidatos = (gastos || []).filter(g => {
          const gMonto = Number(g.monto || 0);
          if (Math.abs(gMonto - movMonto) > 0.05) return false;
          const gFecha = new Date(g.fecha_gasto || g.creado_en);
          const diffDays = Math.abs((movFecha.getTime() - gFecha.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 3;
        });

        if (candidatos.length > 0) {
          const best = candidatos[0];
          sugerencias.push({
            movimiento: mov,
            candidato: best,
            tipo: 'gasto',
            confianza: candidatos.length === 1 ? 'alta' : 'media',
            motivo: `Monto coincidente ($${movMonto.toFixed(2)}) en rango de ±3 días`
          });
        }
      }

      // Si es depósito, buscar en Pedidos
      if (mov.tipo_movimiento === 'Deposito' || Number(mov.deposito || 0) > 0) {
        const candidatos = (pedidos || []).filter(p => {
          const pMonto = Number(p.precio_total || 0);
          if (Math.abs(pMonto - movMonto) > 0.05) return false;
          const pFecha = new Date(p.fecha_pedido || p.creado_en);
          const diffDays = Math.abs((movFecha.getTime() - pFecha.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 3;
        });

        if (candidatos.length > 0) {
          const best = candidatos[0];
          sugerencias.push({
            movimiento: mov,
            candidato: best,
            tipo: 'pedido',
            confianza: candidatos.length === 1 ? 'alta' : 'media',
            motivo: `Monto coincidente ($${movMonto.toFixed(2)}) en rango de ±3 días`
          });
        }
      }
    }

    return { success: true, sugerencias };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Actualiza la categoría asignada a uno o varios movimientos bancarios
 */
export async function actualizarCategoriaMovimientos(
  movimientoIds: string[],
  categoriaId: string | null | undefined,
  token: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!movimientoIds || movimientoIds.length === 0) {
      return { success: false, error: 'No se especificaron movimientos.' };
    }

    const catId = (!categoriaId || categoriaId === '' || categoriaId === 'SIN_CATEGORIA') ? null : categoriaId;

    const { data, error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({ categoria_movimiento_id: catId })
      .in('id', movimientoIds)
      .eq('empresa_id', empresaId)
      .select('id');

    if (error) throw error;
    return { success: true, count: data?.length || 0 };
  } catch (err: any) {
    console.error('Error al actualizar categoría de movimientos:', err);
    return { success: false, error: err.message || 'Error al actualizar categoría' };
  }
}

/**
 * Detecta y elimina movimientos bancarios duplicados existentes para la empresa activa.
 * Considera duplicados:
 * 1) Misma referencia bancaria válida (ej. '413', '437', etc.)
 * 2) Misma fecha, mismo concepto y mismo monto
 * Conserva el registro que esté conciliado (en conciliaciones_bancarias, gastos o pedidos) o el más antiguo.
 */
export async function depurarMovimientosDuplicadosAction(
  token: string
): Promise<{ success: boolean; countDeleted?: number; message?: string; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // 1. Obtener todos los movimientos bancarios de la empresa
    let allMovs: {
      id: string;
      fecha: string;
      concepto: string;
      monto: number;
      retiro: number;
      deposito: number;
      referencia: string | null;
      creado_en?: string;
    }[] = [];

    let page = 0;
    const CHUNK = 1000;
    while (true) {
      const { data: chunk, error } = await supabaseAdmin
        .from('movimientos_bancarios')
        .select('id, fecha, concepto, monto, retiro, deposito, referencia, creado_en')
        .eq('empresa_id', empresaId)
        .range(page * CHUNK, (page + 1) * CHUNK - 1);

      if (error) throw error;
      if (!chunk || chunk.length === 0) break;
      allMovs = allMovs.concat(chunk as any);
      if (chunk.length < CHUNK) break;
      page++;
    }

    if (allMovs.length === 0) {
      return { success: true, countDeleted: 0, message: 'No hay movimientos registrados para analizar.' };
    }

    // 2. Obtener movimientos que están conciliados o vinculados para protegerlos
    const movIds = allMovs.map(m => m.id);

    const { data: concs } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .select('movimiento_id')
      .in('movimiento_id', movIds);

    const { data: gastosVinculados } = await supabaseAdmin
      .from('gastos')
      .select('movimiento_bancario_id')
      .in('movimiento_bancario_id', movIds);

    const { data: pedidosVinculados } = await supabaseAdmin
      .from('pedidos')
      .select('movimiento_bancario_id')
      .in('movimiento_bancario_id', movIds);

    const reconciledIds = new Set<string>();
    concs?.forEach(c => c.movimiento_id && reconciledIds.add(c.movimiento_id));
    gastosVinculados?.forEach(g => g.movimiento_bancario_id && reconciledIds.add(g.movimiento_bancario_id));
    pedidosVinculados?.forEach(p => p.movimiento_bancario_id && reconciledIds.add(p.movimiento_bancario_id));

    const cleanRef = (ref?: string | null): string => {
      if (!ref) return '';
      const r = String(ref).trim();
      const lower = r.toLowerCase();
      if (['', '0', '00', '000', '-', '--', 's/r', 's/n', 's/f', 'null', 'undefined', 'n/a', 'na', 'none'].includes(lower)) {
        return '';
      }
      return lower;
    };

    const normConcept = (concepto?: string | null): string => {
      if (!concepto) return '';
      return String(concepto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // 3. Agrupar duplicados
    const groups: Map<string, typeof allMovs> = new Map();

    for (const mov of allMovs) {
      const cr = cleanRef(mov.referencia);
      let key = '';
      if (cr) {
        key = `ref:${cr}`;
      } else {
        const dateStr = (mov.fecha || '').substring(0, 10);
        const cStr = normConcept(mov.concepto);
        const amtStr = Number(mov.monto || 0).toFixed(2);
        key = `content:${dateStr}|${cStr}|${amtStr}`;
      }

      const existing = groups.get(key) || [];
      existing.push(mov);
      groups.set(key, existing);
    }

    const idsToDelete: string[] = [];

    for (const [, group] of groups.entries()) {
      if (group.length <= 1) continue;

      // Ordenar: primero los conciliados, luego por fecha de creación más antigua
      group.sort((a, b) => {
        const aRec = reconciledIds.has(a.id) ? 1 : 0;
        const bRec = reconciledIds.has(b.id) ? 1 : 0;
        if (aRec !== bRec) return bRec - aRec; // Reconciled first

        const aDate = new Date(a.creado_en || a.fecha || 0).getTime();
        const bDate = new Date(b.creado_en || b.fecha || 0).getTime();
        return aDate - bDate; // Oldest first
      });

      // El primer elemento es el que conservamos
      // Los restantes se eliminan siempre y cuando no estén conciliados de forma separada
      for (let i = 1; i < group.length; i++) {
        const duplicate = group[i];
        if (!reconciledIds.has(duplicate.id)) {
          idsToDelete.push(duplicate.id);
        }
      }
    }

    if (idsToDelete.length === 0) {
      return { success: true, countDeleted: 0, message: 'No se encontraron movimientos duplicados para depurar.' };
    }

    // 4. Eliminar en lotes de 100 con limpieza de referencias foráneas
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const chunk = idsToDelete.slice(i, i + 100);

      await supabaseAdmin
        .from('comprobantes_deposito_movimientos')
        .delete()
        .in('movimiento_id', chunk);

      await supabaseAdmin
        .from('movimientos_bancarios')
        .update({ movimiento_reembolso_id: null })
        .in('movimiento_reembolso_id', chunk);

      const { error: delErr } = await supabaseAdmin
        .from('movimientos_bancarios')
        .delete()
        .in('id', chunk)
        .eq('empresa_id', empresaId);

      if (delErr) throw delErr;
    }

    return {
      success: true,
      countDeleted: idsToDelete.length,
      message: `Se depuraron exitosamente ${idsToDelete.length} movimiento(s) bancario(s) duplicado(s).`
    };
  } catch (err: any) {
    console.error('Error al depurar movimientos duplicados:', err);
    return { success: false, error: err.message || 'Error al depurar duplicados' };
  }
}

/**
 * Actualiza los comentarios y notas de auditoría de un movimiento bancario,
 * y opcionalmente los replica a los gastos vinculados.
 */
export async function actualizarAuditoriaMovimientoAction(
  movimientoId: string,
  comentarios: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId, userId } = await getUserEmpresaId(token);
    if (!movimientoId) throw new Error('ID de movimiento bancario requerido.');

    // Actualizar movimiento
    const { error: movErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({ comentarios: comentarios || null })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (movErr) throw movErr;

    // Actualizar gastos vinculados directamente
    await supabaseAdmin
      .from('gastos')
      .update({ comentarios: comentarios || null })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    return { success: true };
  } catch (err: any) {
    console.error('Error en actualizarAuditoriaMovimientoAction:', err);
    return { success: false, error: err.message || 'Error al actualizar comentarios' };
  }
}

/**
 * Adjunta o actualiza archivos (XML, PDF Factura, Ticket, Soporte Reembolso)
 * directamente a un movimiento bancario y sincroniza con los gastos vinculados.
 */
export async function adjuntarArchivoDirectoAction(
  movimientoId: string,
  fileType: 'xml' | 'pdf_factura' | 'pdf_ticket' | 'soporte_reembolso',
  filePath: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!movimientoId || !filePath) throw new Error('Parámetros insuficientes.');

    const fieldMap: Record<string, string> = {
      xml: 'xml_url',
      pdf_factura: 'pdf_factura_url',
      pdf_ticket: 'pdf_ticket_url',
      soporte_reembolso: 'soporte_reembolso_url'
    };

    const targetField = fieldMap[fileType];
    if (!targetField) throw new Error('Tipo de archivo no soportado.');

    // Obtener valores actuales para concatenar si es necesario
    const { data: currentMov, error: getErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId)
      .single();

    if (getErr || !currentMov) throw new Error('Movimiento bancario no encontrado.');

    const currentUrls = currentMov[targetField] ? String(currentMov[targetField]).split(',').filter(Boolean) : [];
    if (!currentUrls.includes(filePath)) {
      currentUrls.push(filePath);
    }
    const newFieldValue = currentUrls.join(',');

    const updatePayload: Record<string, any> = {
      [targetField]: newFieldValue
    };

    const { error: updateErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update(updatePayload)
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (updateErr) throw updateErr;

    // Sincronizar con gastos vinculados si aplica
    if (fileType === 'xml' || fileType === 'pdf_factura' || fileType === 'pdf_ticket') {
      const gastoField = fileType === 'xml' ? 'xml_url' : fileType === 'pdf_factura' ? 'pdf_url' : 'ticket_url';
      await supabaseAdmin
        .from('gastos')
        .update({ [gastoField]: newFieldValue })
        .eq('movimiento_bancario_id', movimientoId)
        .eq('empresa_id', empresaId);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error en adjuntarArchivoDirectoAction:', err);
    return { success: false, error: err.message || 'Error al adjuntar archivo' };
  }
}

