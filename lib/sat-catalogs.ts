// lib/sat-catalogs.ts
// Catálogos oficiales del SAT para CFDI 4.0.
// Fuente única de verdad para todos los módulos del ERP.

export const CATALOGO_REGIMEN_FISCAL = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', descripcion: 'Arrendamiento' },
  { clave: '608', descripcion: 'Demás ingresos' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza (RESICO)' }
] as const;

export const CATALOGO_USO_CFDI = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'I01', descripcion: 'Construcciones' },
  { clave: 'S01', descripcion: 'Sin efectos fiscales' },
  { clave: 'P01', descripcion: 'Por definir' }
] as const;

export type ClaveRegimenFiscal = typeof CATALOGO_REGIMEN_FISCAL[number]['clave'];
export type ClaveUsoCfdi = typeof CATALOGO_USO_CFDI[number]['clave'];

/** Devuelve la descripción de un régimen fiscal a partir de su clave. */
export const getDescripcionRegimenFiscal = (clave: string): string =>
  CATALOGO_REGIMEN_FISCAL.find(r => r.clave === clave)?.descripcion ?? clave;

/** Devuelve la descripción de un uso de CFDI a partir de su clave. */
export const getDescripcionUsoCfdi = (clave: string): string =>
  CATALOGO_USO_CFDI.find(u => u.clave === clave)?.descripcion ?? clave;
