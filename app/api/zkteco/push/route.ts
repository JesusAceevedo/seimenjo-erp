import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Maneja la inicialización del dispositivo (handshake) y solicitudes de comandos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN');
  const options = searchParams.get('options');
  const cmd = searchParams.get('cmd');

  console.log(`[ZKTeco ADMS] Recibida petición GET del reloj - SN: ${sn}, options: ${options}, cmd: ${cmd}`);

  if (!sn) {
    console.warn('[ZKTeco ADMS] Petición GET rechazada: Falta número de serie (SN)');
    return new NextResponse('Error: SN missing', { status: 400 });
  }

  // 1. Handshake Inicial
  if (options === 'all') {
    const tz = process.env.ZKTECO_TIMEZONE || '-5';
    const configResponse = [
      'RegistryCode=0',
      'ServerVersion=3.1.1',
      'ServerName=ADMS',
      'PushVersion=3.1.1',
      'SendTemp=1',
      'ErrorDelay=30',
      'Delay=10',
      'TransInterval=10',
      'TransFlag=1000000000',
      `TimeZone=${tz}`,
      'Realtime=1',
      'Encrypt=0'
    ].join('\n');
    return new NextResponse(configResponse, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // 2. Solicitud de Comandos pendientes del servidor al reloj
  if (cmd === 'getrequest') {
    // Consultar comandos que no hayan sido procesados para esta empresa y este dispositivo (o genéricos)
    const { data: comandos, error } = await supabaseAdmin
      .from('zkteco_comandos')
      .select('comando_id, comando_texto')
      .eq('procesado', false)
      .or(`dispositivo_sn.is.null,dispositivo_sn.eq.${sn}`)
      .order('creado_en', { ascending: true })
      .limit(10);

    if (error) {
      console.error('[ZKTeco ADMS] Error al consultar comandos pendientes en Supabase:', error);
      return new NextResponse('OK', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (comandos && comandos.length > 0) {
      const responseBody = comandos.map(c => `C:${c.comando_id}:${c.comando_texto}`).join('\n');
      console.log(`[ZKTeco ADMS] Enviando ${comandos.length} comando(s) pendiente(s) al reloj:\n${responseBody}`);
      return new NextResponse(responseBody, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new NextResponse('OK', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return new NextResponse('OK', {
    headers: { 'Content-Type': 'text/plain' }
  });
}

// POST: Recibe las checadas y bitácoras del dispositivo
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const sn = searchParams.get('SN');
  const table = searchParams.get('table');

  // Si es confirmación de ejecución de comando (devicecmd)
  if (url.pathname.includes('devicecmd')) {
    const rawBody = await request.text();
    console.log(`[ZKTeco ADMS] Recibida respuesta de comandos - SN: ${sn || 'N/A'}:\n${rawBody}`);

    // Parsear líneas en formato: ID=101&Return=0
    const lines = rawBody.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const params = new URLSearchParams(trimmed);
      const id = params.get('ID');
      const ret = params.get('Return');

      if (id) {
        console.log(`[ZKTeco ADMS] Comando ${id} ejecutado en el reloj con retorno: ${ret}`);
        await supabaseAdmin
          .from('zkteco_comandos')
          .update({
            procesado: true,
            resultado: ret || '0',
            procesado_en: new Date().toISOString()
          })
          .eq('comando_id', id);
      }
    }

    return new NextResponse('OK', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.log(`[ZKTeco ADMS] Recibida petición POST del reloj - SN: ${sn}, table: ${table}`);

  if (!sn) {
    console.warn('[ZKTeco ADMS] Petición POST rechazada: Falta número de serie (SN)');
    return new NextResponse('Error: SN missing', { status: 400 });
  }

  const rawBody = await request.text();

  // Si es subida de logs de asistencia (ATTLOG)
  if (table === 'ATTLOG') {
    // Formato típico de línea de ADMS:
    // USERID\tCHECKTIME\tVERIFYTYPE\tSTATUS\tWORKCODE\tRESERVED
    const lines = rawBody.split('\n');
    const records = [];

    // Buscamos una empresa por defecto si es que no está especificado el SN en configuración.
    // En un sistema multiempresa real, se vincularía el SN del dispositivo a su empresa_id.
    const { data: configEmpresa } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .limit(1)
      .maybeSingle();
      
    const defaultEmpresaId = configEmpresa?.id;

    if (!defaultEmpresaId) {
      console.error('No se encontró ninguna empresa en la base de datos.');
      return new NextResponse('ERROR: No company found', { status: 500 });
    }

    // 1. Obtener todos los IDs de usuario del biométrico en este batch
    const userIdsInBatch = lines
      .map(line => {
        const parts = line.trim().split('\t');
        return parts.length >= 2 ? parts[0] : null;
      })
      .filter(Boolean) as string[];

    // 2. Mapear cada zkteco_user_id a su respectivo empresa_id
    const empresaMap = new Map<string, string>();
    if (userIdsInBatch.length > 0) {
      const { data: empleados } = await supabaseAdmin
        .from('empleados_detalle')
        .select('zkteco_user_id, empresa_id')
        .in('zkteco_user_id', userIdsInBatch);

      if (empleados) {
        empleados.forEach(emp => {
          if (emp.zkteco_user_id) {
            empresaMap.set(emp.zkteco_user_id, emp.empresa_id);
          }
        });
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split('\t');
      if (parts.length >= 2) {
        const zkteco_user_id = parts[0];
        const timestampStr = parts[1]; // Formato: YYYY-MM-DD HH:mm:ss
        const statusType = parts[3]; // Status de checada (0=entrada, 1=salida)
        
        let tipo_evento = 'CHECKIN';
        if (statusType === '1') tipo_evento = 'CHECKOUT';
        else if (statusType === '2') tipo_evento = 'BREAK_OUT';
        else if (statusType === '3') tipo_evento = 'BREAK_IN';

        let metodo_verificacion = 'OTHER';
        if (parts[2] === '15') metodo_verificacion = 'FACE';
        else if (parts[2] === '1') metodo_verificacion = 'FINGER';
        else if (parts[2] === '4') metodo_verificacion = 'CARD';
        else if (parts[2] === '3') metodo_verificacion = 'PASS';

        // Obtener el empresa_id correcto del empleado o usar el default
        const recordEmpresaId = empresaMap.get(zkteco_user_id) || defaultEmpresaId;

        // Parsear fecha y hora aplicando la zona horaria correcta
        try {
          const offset = process.env.ZKTECO_TIMEZONE_OFFSET || '-05:00';
          const formattedStr = timestampStr.includes(' ') 
            ? `${timestampStr.replace(' ', 'T')}${offset}` 
            : timestampStr;
          const timestamp = new Date(formattedStr).toISOString();
          records.push({
            empresa_id: recordEmpresaId,
            zkteco_user_id,
            dispositivo_sn: sn,
            timestamp,
            tipo_evento,
            metodo_verificacion,
            procesado: false
          });
        } catch (e) {
          console.error('Error parseando fecha:', timestampStr, e);
        }
      }
    }

    if (records.length > 0) {
      const { error } = await supabaseAdmin
        .from('asistencia_checadas_raw')
        .insert(records);

      if (error) {
        console.error('Error insertando logs biométricos en Supabase:', error);
        return new NextResponse('ERROR', { status: 500 });
      }
    }

    // Responder con la confirmación "OK"
    return new NextResponse('OK', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Responder OK para otras tablas (OPERLOG, USERINFO)
  return new NextResponse('OK', {
    headers: { 'Content-Type': 'text/plain' }
  });
}
