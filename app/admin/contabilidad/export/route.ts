import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo') || 'B'; // 'CT' | 'B' | 'PL'
    const periodo = searchParams.get('periodo') || new Date().toISOString().substring(0, 7);
    const [anio, mes] = periodo.split('-');

    // Fetch CUC catalog accounts
    const { data: cuentas } = await supabaseAdmin
      .from('cuentas_contables')
      .select('*')
      .order('codigo', { ascending: true });

    if (tipo === 'CT') {
      // Catálogo de cuentas XML (CT.sch Anexo 20 v1.3)
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<catalogocuentas:Catalogo xmlns:catalogocuentas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas" `;
      xml += `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `;
      xml += `Version="1.3" RFC="XAXX010101000" Mes="${mes}" Anio="${anio}">\n`;

      (cuentas || []).forEach(c => {
        xml += `  <catalogocuentas:Ctas CodAgrup="${c.codigo}" NumCta="${c.codigo}" Desc="${c.nombre}" Nivel="${c.nivel}" Natur="${c.naturaleza === 'deudora' ? 'D' : 'A'}"/>\n`;
      });

      xml += `</catalogocuentas:Catalogo>`;

      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="CatalogoCuentas_${anio}_${mes}.xml"`
        }
      });
    }

    if (tipo === 'B') {
      // Balanza de Comprobación XML (B.sch Anexo 20 v1.3)
      const { data: detalles } = await supabaseAdmin
        .from('asientos_detalle')
        .select('cuenta_contable_id, cargo, abono, asientos!inner(periodo, estatus)')
        .eq('asientos.periodo', periodo)
        .neq('asientos.estatus', 'cancelado');

      const sumas: Record<string, { cargos: number; abonos: number }> = {};
      (detalles || []).forEach((d: any) => {
        const cId = d.cuenta_contable_id;
        if (!sumas[cId]) sumas[cId] = { cargos: 0, abonos: 0 };
        sumas[cId].cargos += Number(d.cargo || 0);
        sumas[cId].abonos += Number(d.abono || 0);
      });

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<BalanzaComprobacion:Balanza xmlns:BalanzaComprobacion="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion" `;
      xml += `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `;
      xml += `Version="1.3" RFC="XAXX010101000" Mes="${mes}" Anio="${anio}" TipoEnvio="N">\n`;

      (cuentas || []).forEach(c => {
        const s = sumas[c.id] || { cargos: 0, abonos: 0 };
        const ini = 0.00;
        const fin = c.naturaleza === 'deudora' ? ini + (s.cargos - s.abonos) : ini + (s.abonos - s.cargos);

        xml += `  <BalanzaComprobacion:Ctas NumCta="${c.codigo}" SaldoIni="${ini.toFixed(2)}" Debe="${s.cargos.toFixed(2)}" Haber="${s.abonos.toFixed(2)}" SaldoFin="${fin.toFixed(2)}"/>\n`;
      });

      xml += `</BalanzaComprobacion:Balanza>`;

      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="BalanzaComprobacion_${anio}_${mes}.xml"`
        }
      });
    }

    return NextResponse.json({ error: 'Tipo de exportación inválido' }, { status: 400 });
  } catch (err: any) {
    console.error('Error exportando XML SAT:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
