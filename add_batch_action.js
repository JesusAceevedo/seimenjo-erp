const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'actions.ts');
let content = fs.readFileSync(file, 'utf8');

const newFunction = `
export async function procesarLoteFacturas(payloads: {
  isGasto: boolean;
  xmlData: {
    total: number;
    subtotal: number;
    iva: number;
    fecha: string;
    serie: string;
    folio: string;
    formaPagoCode: string;
    uuid: string;
    fechaTimbrado: string;
    emisorRfc: string;
    emisorNombre: string;
    receptorRfc: string;
    receptorNombre: string;
    usoCfdi?: string;
    isComplementoPago?: boolean;
    uuidsRelacionados?: string[];
    isCanceled?: boolean;
  };
  xmlUrl?: string;
}[], token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const estatusFacturaId = await getEstatusFacturaIdByName('Facturado');
    // Asumimos que podemos necesitar el ID de cancelado, pero si falla getEstatusFacturaIdByName, usaremos otro enfoque.
    // getEstatusFacturaIdByName('Cancelado')
    
    let agregados = 0;
    let actualizados = 0;
    let ignorados = 0;
    let errores = 0;

    for (const payload of payloads) {
      try {
        const { isGasto, xmlData, xmlUrl } = payload;
        const formaPagoId = await getFormaPagoIdByCode(xmlData.formaPagoCode);
        
        let targetTable = isGasto ? 'gastos' : 'facturas_clientes';
        
        // Check if exists by UUID
        const { data: existingRecord } = await supabaseAdmin
          .from(targetTable)
          .select('id, uuid_fiscal, monto, subtotal, iva_acreditable, estatus_facturado, total')
          .eq('uuid_fiscal', xmlData.uuid)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (existingRecord) {
          // Si es cancelación explícita en el payload
          if (xmlData.isCanceled) {
             const { error: updErr } = await supabaseAdmin
               .from(targetTable)
               .update({ 
                  monto: 0, 
                  subtotal: 0, 
                  ...(isGasto ? { iva_acreditable: 0 } : {}), 
                  ...(isGasto ? {} : { total: 0 }),
                  estatus_facturado: false // O un estatus específico de cancelación
               })
               .eq('id', existingRecord.id);
             if (!updErr) actualizados++; else errores++;
             continue;
          }

          // Si existe pero no está cancelado, verificamos si los montos difieren
          const currentTotal = isGasto ? existingRecord.monto : existingRecord.total;
          if (Math.abs(Number(currentTotal) - Number(xmlData.total)) > 0.01) {
             // Actualizar montos
             const { error: updErr } = await supabaseAdmin
               .from(targetTable)
               .update({ 
                  ...(isGasto ? { monto: xmlData.total, subtotal: xmlData.subtotal, iva_acreditable: xmlData.iva } : { total: xmlData.total, subtotal: xmlData.subtotal }), 
                  ...(xmlUrl ? { xml_url: xmlUrl } : {})
               })
               .eq('id', existingRecord.id);
             if (!updErr) actualizados++; else errores++;
          } else {
             ignorados++;
          }
        } else {
          // NO EXISTE -> INSERTAR NUEVO
          if (isGasto) {
             // Proveedor
             let proveedorId = null;
             if (xmlData.emisorRfc) {
               const { data: prov } = await supabaseAdmin
                 .from('proveedores')
                 .select('id')
                 .eq('rfc', xmlData.emisorRfc.toUpperCase())
                 .eq('empresa_id', empresaId)
                 .maybeSingle();
               if (prov) {
                 proveedorId = prov.id;
               } else {
                 const { data: newProv } = await supabaseAdmin
                   .from('proveedores')
                   .insert({
                     rfc: xmlData.emisorRfc.toUpperCase(),
                     nombre_comercial: xmlData.emisorNombre || xmlData.emisorRfc,
                     razon_social: xmlData.emisorNombre || xmlData.emisorRfc,
                     empresa_id: empresaId
                   })
                   .select('id').single();
                 if (newProv) proveedorId = newProv.id;
               }
             }

             const { error: insErr } = await supabaseAdmin
               .from('gastos')
               .insert({
                 fecha_gasto: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
                 concepto: xmlData.usoCfdi ? \`Factura (Uso: \${xmlData.usoCfdi})\` : 'Gasto Facturado',
                 monto: xmlData.total,
                 subtotal: xmlData.subtotal,
                 iva_acreditable: xmlData.iva,
                 uuid_fiscal: xmlData.uuid,
                 fecha_timbrado: xmlData.fechaTimbrado || null,
                 xml_url: xmlUrl,
                 proveedor_id: proveedorId,
                 forma_pago_id: formaPagoId,
                 estatus_factura_id: estatusFacturaId,
                 estatus_facturado: true,
                 metodo_pago: xmlData.formaPagoCode === '01' ? 'Efectivo' : 'Transferencia',
                 empresa_id: empresaId
               });
             if (!insErr) agregados++; else errores++;
          } else {
             // Factura Cliente (Ventas)
             const { error: insErr } = await supabaseAdmin
               .from('facturas_clientes')
               .insert({
                 pedido_id: null, // Factura suelta
                 fecha_emision: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
                 subtotal: xmlData.subtotal,
                 iva: xmlData.iva,
                 total: xmlData.total,
                 uuid_fiscal: xmlData.uuid,
                 fecha_timbrado: xmlData.fechaTimbrado || null,
                 xml_url: xmlUrl,
                 empresa_id: empresaId
               });
             if (!insErr) agregados++; else errores++;
          }
        }
      } catch (err) {
        console.error('Error procesando payload masivo:', err);
        errores++;
      }
    }

    return { success: true, resumen: { agregados, actualizados, ignorados, errores } };
  } catch (error: any) {
    console.error('Error en procesarLoteFacturas:', error);
    return { success: false, error: error.message || 'Error al procesar el lote.' };
  }
}
`;

content += newFunction;
fs.writeFileSync(file, content, 'utf8');
console.log('procesarLoteFacturas added.');
