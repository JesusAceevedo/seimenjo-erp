const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

const targetLogic = `          payloads.push({
            isGasto: invoiceType === 'gasto',
            xmlData: {
              total: Number(total),
              subtotal: Number(subtotal),
              iva,
              fecha: comprobante.Fecha,
              serie: comprobante.Serie || '',
              folio: comprobante.Folio || '',
              formaPagoCode: comprobante.FormaPago || '99',
              uuid,
              fechaTimbrado: timbre?.FechaTimbrado || '',
              emisorRfc: emisor?.Rfc || '',
              emisorNombre: emisor?.Nombre || '',
              receptorRfc: receptor?.Rfc || '',
              receptorNombre: receptor?.Nombre || '',
              usoCfdi: receptor?.UsoCFDI || '',
              isComplementoPago: comprobante.TipoDeComprobante === 'P',
              isCanceled
            }
          });`;

const newLogic = `          // Upload XML file to Supabase
          const dateStr = comprobante.Fecha || new Date().toISOString();
          const yearMonth = dateStr.substring(0, 7);
          const timestamp = Date.now();
          const xmlPath = \`facturas/\${yearMonth}/\${timestamp}_\${file.name.replace(/\\s+/g, '_')}\`;
          
          let uploadedXmlUrl = '';
          const { error: uploadErr } = await supabase.storage.from('facturas').upload(xmlPath, file);
          if (!uploadErr) {
             uploadedXmlUrl = xmlPath;
          }

          payloads.push({
            isGasto: invoiceType === 'gasto',
            xmlUrl: uploadedXmlUrl,
            xmlData: {
              total: Number(total),
              subtotal: Number(subtotal),
              iva,
              fecha: comprobante.Fecha,
              serie: comprobante.Serie || '',
              folio: comprobante.Folio || '',
              formaPagoCode: comprobante.FormaPago || '99',
              uuid,
              fechaTimbrado: timbre?.FechaTimbrado || '',
              emisorRfc: emisor?.Rfc || '',
              emisorNombre: emisor?.Nombre || '',
              receptorRfc: receptor?.Rfc || '',
              receptorNombre: receptor?.Nombre || '',
              usoCfdi: receptor?.UsoCFDI || '',
              isComplementoPago: comprobante.TipoDeComprobante === 'P',
              isCanceled
            }
          });`;

content = content.replace(targetLogic, newLogic);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed mass upload file saving to bucket.');
