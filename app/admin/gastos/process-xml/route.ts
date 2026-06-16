import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';

export async function POST(req: Request) {
  // 1. SOLUCIÓN A VERCEL: Inicializamos a Supabase DENTRO de la función.
  // Así evitamos que Next.js intente leer variables faltantes durante el "build".
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // 2. FALLBACK INTELIGENTE: Si no tienes el Service Role en Vercel, usará tu llave pública (Anon Key).
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 400 });

    const text = await file.text();

    // 3. SOLUCIÓN CRÍTICA PARA CFDI: 'ignoreAttributes: false' es obligatorio
    // para poder leer correctamente los campos que empiezan con "@_"
    const parser = new XMLParser({ ignoreAttributes: false });
    const jsonObj = parser.parse(text);

    const cfdi = jsonObj['cfdi:Comprobante'];
    if (!cfdi) throw new Error("El archivo XML no es un CFDI válido");

    const emisor = cfdi['cfdi:Emisor'];

    // Manejamos variaciones de mayúsculas entre CFDI 3.3 y 4.0
    const rfcEmisor = emisor?.['@_Rfc'] || emisor?.['@_rfc'];
    const nombreEmisor = emisor?.['@_Nombre'] || emisor?.['@_nombre'];
    const total = parseFloat(cfdi['@_Total'] || cfdi['@_total']);

    if (!rfcEmisor) throw new Error("No se pudo extraer el RFC del archivo XML");

    // 4. UPSERT del Proveedor 
    const { data: proveedor, error: provError } = await supabase
      .from('proveedores')
      .upsert({ rfc: rfcEmisor, nombre_comercial: nombreEmisor }, { onConflict: 'rfc' })
      .select('id')
      .single();

    if (provError) throw provError;

    // 5. Registro del Gasto
    const { error: gastoError } = await supabase
      .from('gastos')
      .insert({
        proveedor_id: proveedor.id,
        monto: total,
        fecha_gasto: new Date().toISOString(), // Se puede mejorar para leer la fecha del CFDI
        concepto: 'Gasto automatizado vía XML CFDI'
      });

    if (gastoError) throw gastoError;

    return NextResponse.json({ message: 'Gasto registrado correctamente' });
  } catch (error: unknown) {
    console.error('Error procesando XML:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message || 'Error en el procesamiento' }, { status: 500 });
  }
}