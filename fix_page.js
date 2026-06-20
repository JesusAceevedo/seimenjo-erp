const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  /obtenerFacturasPorProveedor\r?\n\} from '\.\/actions';/,
  `obtenerFacturasPorProveedor,\n  actualizarCategoriaGasto\n} from './actions';`
);

content = content.replace(
  /import BancoTab from '\.\/_components\/BancoTab';\r?\nimport ProveedoresTab from '\.\/_components\/ProveedoresTab';/,
  `import BancoTab from './_components/BancoTab';`
);

// 2. Types
content = content.replace(
  /monto: number;\r?\n  iva_acreditable\?: number;\r?\n  proveedores\?: \{ nombre_comercial: string; rfc: string \};\r?\n  categorias_gasto\?: \{ nombre: string \};/,
  `monto: number;\n  subtotal?: number;\n  iva_acreditable?: number;\n  metodo_pago?: string;\n  categoria_id?: string | null;\n  proveedores?: { nombre_comercial: string; rfc: string };\n  categorias_gasto?: { id: string; nombre: string } | null;`
);

// 3. activeTab
content = content.replace(
  /const \[activeTab, setActiveTab\] = useState<'egresos' \| 'ingresos' \| 'banco' \| 'proveedores'>\('egresos'\);/,
  `const [activeTab, setActiveTab] = useState<'egresos' | 'ingresos' | 'banco'>('egresos');`
);

// 4. Proveedores state
content = content.replace(
  /\/\/ --- ESTADOS DE PROVEEDORES ---[\s\S]*?error: ''\r?\n  \}\);/,
  ``
);

// 5. Categorias state
content = content.replace(
  /const \[facturasSueltas, setFacturasSueltas\] = useState<any\[\]>\(\[\]\);/,
  `const [facturasSueltas, setFacturasSueltas] = useState<any[]>([]);\n  const [categorias, setCategorias] = useState<{ id: string; nombre: string; tipo?: string }[]>([]);`
);

// 6. fetchData Gastos
content = content.replace(
  /\.select\('\*, proveedores\(nombre_comercial, rfc\), categorias_gasto\(nombre\), padre:gastos!gasto_padre_id\(concepto\)'\)/,
  `.select('*, metodo_pago, proveedores(nombre_comercial, rfc), categorias_gasto(id, nombre), padre:gastos!gasto_padre_id(concepto)')`
);

// 7. fetchData Proveedores -> Categorias
content = content.replace(
  /\/\/ 11\. Proveedores[\s\S]*?setProveedores\(provs \|\| \[\]\);/,
  `// 10. Categorías de gasto\n      const { data: catData } = await supabase\n        .from('categorias_gasto')\n        .select('id, nombre, tipo')\n        .order('nombre', { ascending: true });\n      setCategorias(catData || []);`
);

// 8. Handlers
content = content.replace(
  /const cargarDetallesProveedor = async \(proveedor: any\) => \{[\s\S]*?alert\(err\.message \|\| 'Error al eliminar el proveedor\.'\);\r?\n    \}\r?\n  \};/,
  ``
);

// 9. Add handleUpdateCategoria
content = content.replace(
  /const handleOpenReconcileModal = async \(mov: any\) => \{/,
  `const handleUpdateCategoria = async (gastoId: string, categoriaId: string | null) => {\n    try {\n      const token = await getSessionToken();\n      const res = await actualizarCategoriaGasto(gastoId, categoriaId, token);\n      if (res.success) {\n        setGastosFacturados(prev => prev.map(g => g.id === gastoId ? { ...g, categoria_id: categoriaId } : g));\n      } else {\n        alert(res.error || 'Error al actualizar categoría.');\n      }\n    } catch (err: any) {\n      alert(err.message || 'Error de red.');\n    }\n  };\n\n  const handleOpenReconcileModal = async (mov: any) => {`
);

// 10. Proveedores Tab Button
content = content.replace(
  /<button\r?\n\s*onClick=\{\(\) => setActiveTab\('proveedores'\)\}[\s\S]*?<Users size=\{16\} \/> Proveedores\r?\n\s*<\/button>/,
  ``
);

// 11. EgresosTab Props
content = content.replace(
  /<EgresosTab\r?\n\s*gastosFacturados=\{gastosFacturados\}\r?\n\s*onOpenComprobacionAcumulada/g,
  `<EgresosTab\n                gastosFacturados={gastosFacturados}\n                categorias={categorias}\n                onUpdateCategoria={handleUpdateCategoria}\n                onOpenComprobacionAcumulada`
);

// 12. TAB 4 Proveedores
content = content.replace(
  /\{\/\* TAB 4: PROVEEDORES \*\/\}[\s\S]*?onDownloadFile=\{handleDownloadFile\}\r?\n\s*\/>\r?\n\s*\)\}/,
  ``
);

// 13. Proveedores Modal
content = content.replace(
  /\{\/\* MODAL: REGISTRAR \/ EDITAR PROVEEDOR \*\/\}[\s\S]*?\{\/\* MODAL SIMULACION CORREO \*\/}/,
  `{/* MODAL SIMULACION CORREO */}`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Replacements done!');
