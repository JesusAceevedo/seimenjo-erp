import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 400 });

    const text = await file.text();
    const parser = new XMLParser();
    const jsonObj = parser.parse(text);

    // Nota: La estructura del XML depende de la versión CFDI (3.3 o 4.0)
    // Ajusta estas rutas según el esquema del SAT
    const rfcEmisor = jsonObj['cfdi:Comprobante']?.['cfdi:Emisor']?.['@_Rfc'];
    const nombreEmisor = jsonObj['cfdi:Comprobante']?.['cfdi:Emisor']?.['@_Nombre'];
    const total = parseFloat(jsonObj['cfdi:Comprobante']?.['@_Total']);

    // 1. UPSERT del Proveedor 
    const { data: proveedor, error: provError } = await supabase
      .from('proveedores')
      .upsert({ rfc: rfcEmisor, nombre_comercial: nombreEmisor }, { onConflict: 'rfc' })
      .select('id')
      .single();

    if (provError) throw provError;

    // 2. Registro del Gasto [cite: 106, 148]
    const { error: gastoError } = await supabase
      .from('gastos')
      .insert({
        proveedor_id: proveedor.id,
        monto: total,
        fecha_gasto: new Date().toISOString(), // O extraído del XML
        concepto: 'Gasto automatizado vía XML'
      });

    if (gastoError) throw gastoError;

    return NextResponse.json({ message: 'Gasto registrado correctamente' });
  } catch (error) {
    return NextResponse.json({ error: 'Error en el procesamiento' }, { status: 500 });
  }
}