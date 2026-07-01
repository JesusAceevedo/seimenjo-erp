import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Maneja la inicialización del dispositivo (handshake) y solicitudes de comandos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN');
  const options = searchParams.get('options');
  const cmd = searchParams.get('cmd');

  if (!sn) {
    return new NextResponse('Error: SN missing', { status: 400 });
  }

  // 1. Handshake Inicial
  if (options === 'all') {
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
      'TimeZone=1',
      'Realtime=1',
      'Encrypt=0'
    ].join('\n');
    return new NextResponse(configResponse, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // 2. Solicitud de Comandos pendientes del servidor al reloj
  if (cmd === 'getrequest') {
    // Si no hay comandos pendientes a enviar al dispositivo, responde con OK
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
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN');
  const table = searchParams.get('table');

  if (!sn) {
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
      
    const empresaId = configEmpresa?.id;

    if (!empresaId) {
      console.error('No se encontró ninguna empresa en la base de datos.');
      return new NextResponse('ERROR: No company found', { status: 500 });
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

        // Parsear fecha y hora
        try {
          const timestamp = new Date(timestampStr).toISOString();
          records.push({
            empresa_id: empresaId,
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
