const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// I will just replace the exact broken section with the original content
// The broken section starts from "interface GastoFacturado {" and ends before "const init = async () => {"

const originalBlock = `  // --- ESTADOS DE CONCILIACIÓN BANCARIA ---
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [estatusCatalog, setEstatusCatalog] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'global' | 'catalogo' | 'formas_pago'>('movimientos');

  const [formasPagoModal, setFormasPagoModal] = useState<{
    open: boolean;
    id?: string;
    nombre: string;
    loading: boolean;
  }>({
    open: false,
    nombre: '',
    loading: false
  });
  
  // Filtros de movimientos bancarios
  const [filtroBancoTipo, setFiltroBancoTipo] = useState<string>('');
  const [filtroBancoEstatus, setFiltroBancoEstatus] = useState<string>('');
  const [filtroBancoVisibilidad, setFiltroBancoVisibilidad] = useState<string>('todos');
  const [busquedaBanco, setBusquedaBanco] = useState<string>('');
  
  // Paginación de movimientos
  const [bancoPage, setBancoPage] = useState<number>(0);
  const [bancoPageSize, setBancoPageSize] = useState<number>(10);

  // Estados de carga e importación de Excel
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [columnMapping, setColumnMapping] = useState<{
    fecha: string;
    concepto: string;
    retiro: string;
    deposito: string;
    referencia: string;
  }>({
    fecha: '',
    concepto: '',
    retiro: '',
    deposito: '',
    referencia: ''
  });

  // Modal de conciliación manual
  const [reconcileModal, setReconcileModal] = useState<{
    open: boolean;
    movimiento: any | null;
    xmlUrl: string;
    pdfFacturaUrl: string;
    pdfTicketUrl: string;
    storageProvider: 'Supabase' | 'GoogleDrive';
    gastosSeleccionados: string[];
    pedidosSeleccionados: string[];
    estatusClave: string;
    loading: boolean;
    error: string;
  }>({
    open: false,
    movimiento: null,
    xmlUrl: '',
    pdfFacturaUrl: '',
    pdfTicketUrl: '',
    storageProvider: 'Supabase',
    gastosSeleccionados: [],
    pedidosSeleccionados: [],
    estatusClave: '',
    loading: false,
    error: ''
  });

  const [manualMatchSearch, setManualMatchSearch] = useState<string>('');

  // Modal para agregar/editar estatus del catálogo
  const [catalogEditModal, setCatalogEditModal] = useState<{
    open: boolean;
    id?: string;
    clave: string;
    nombre: string;
    descripcion: string;
    color: string;
    loading: boolean;
  }>({
    open: false,
    clave: '',
    nombre: '',
    descripcion: '',
    color: '#9CA3AF',
    loading: false
  });

  // --- ESTADOS DE DATOS ---
  const [gastosFacturados, setGastosFacturados] = useState<GastoFacturado[]>([]);
  const [categorias, setCategorias] = useState<{id: string, nombre: string}[]>([]);
  const [ventasFacturadas, setVentasFacturadas] = useState<VentaFacturada[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([]);
  const [gastosPendientes, setGastosPendientes] = useState<GastoPendiente[]>([]);
  const [gastosReconciliables, setGastosReconciliables] = useState<GastoReconciliable[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [facturasSueltas, setFacturasSueltas] = useState<any[]>([]);
  const [selectedGlobalDepositId, setSelectedGlobalDepositId] = useState<string | null>(null);
  const [selectedGlobalPedidosIds, setSelectedGlobalPedidosIds] = useState<string[]>([]);
  const [comprobacionAcumuladaModal, setComprobacionAcumuladaModal] = useState({
    open: false,
    egresoPadreId: '',
    seleccionados: [] as string[],
    comentario: '',
    loading: false,
    error: ''
  });

  const [facturacionAcumuladaModal, setFacturacionAcumuladaModal] = useState({
    open: false,
    clienteId: '',
    pedidos: [] as any[],
    seleccionados: [] as string[],
    folio: '',
    loading: false,
    error: ''
  });

  // --- ESTADOS DE CARGA DE ARCHIVOS ---
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlUrlInput, setXmlUrlInput] = useState<string>('');
  const [xmlStorageProvider, setXmlStorageProvider] = useState<'Supabase' | 'GoogleDrive'>('Supabase');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrlInput, setPdfUrlInput] = useState<string>('');
  const [pdfStorageProvider, setPdfStorageProvider] = useState<'Supabase' | 'GoogleDrive'>('Supabase');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [ticketUrlInput, setTicketUrlInput] = useState<string>('');
  const [ticketStorageProvider, setTicketStorageProvider] = useState<'Supabase' | 'GoogleDrive'>('Supabase');
  const [invoiceType, setInvoiceType] = useState<'gasto' | 'venta'>('gasto');
  const [asociarExistente, setAsociarExistente] = useState<boolean>(false);
  const [asociarRegistroId, setAsociarRegistroId] = useState<string>('');

  // --- ESTADOS DE PARSEO XML ---
  const [parsedXmlData, setParsedXmlData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // --- ESTADOS DE UI / PROCESAMIENTO ---
  const [isUploading, setIsUploading] = useState(false);
  const [cfdiViewerModal, setCfdiViewerModal] = useState<{open: boolean, xmlUrl: string | null}>({open: false, xmlUrl: null});
  const [uploadMode, setUploadMode] = useState<'individual' | 'masiva'>('individual');
  const [massXmlFiles, setMassXmlFiles] = useState<File[]>([]);
  const [massUploadStatus, setMassUploadStatus] = useState<'idle' | 'processing' | 'done'>('idle');
  const [massUploadResults, setMassUploadResults] = useState<any>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [emailModal, setEmailModal] = useState<{ open: boolean; details: any | null }>({ open: false, details: null });

  // --- CARGA DE DATOS ---
  const fetchData = async () => {
    try {
      // 1. Gastos facturados (con XML)
      const { data: gFac } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc), categorias_gasto(id, nombre), padre:gastos!gasto_padre_id(concepto)')
        .not('uuid_fiscal', 'is', null)
        .order('fecha_gasto', { ascending: false });
      setGastosFacturados(gFac || []);

      // 2. Todas las Ventas (Facturadas y no Facturadas)
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion), facturas_clientes(*)')
        .neq('estatus_pago', 'Cancelado')
        .order('created_at', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 3. Pedidos pendientes de facturar (solo liquidados)
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, cliente_nombre, fecha_pedido')
        .is('folio_factura', null)
        .eq('estatus_pago', 'Liquidado')
        .order('created_at', { ascending: false });
      setPedidosPendientes(pPend || []);

      // 4. Gastos pendientes de facturar/comprobar (egresos manuales sin comprobante)
      const { data: gPend } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto')
        .is('uuid_fiscal', null)
        .eq('estatus_facturado', false)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosPendientes(gPend || []);

      // 10. Gastos sin conciliar (para conciliación manual bancaria: con o sin XML, pero sin movimiento bancario enlazado)
      const { data: gReconcile } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, xml_url, pdf_url, ticket_url')
        .is('movimiento_bancario_id', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosReconciliables(gReconcile || []);

      // 5. Facturas XML de gastos sueltas (para comprobación acumulada)
      const { data: fSueltas } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc)')
        .not('uuid_fiscal', 'is', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setFacturasSueltas(fSueltas || []);

      // 6. Clientes para facturación acumulada
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nombre_local, rfc')
        .order('nombre_local', { ascending: true });
      setClientes(cliData || []);

      // 11. Proveedores
      const { data: provs } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre_comercial', { ascending: true });
      setProveedores(provs || []);

      // 7. Movimientos bancarios (con catálogo enlazado)
      const { data: movs } = await supabase
        .from('movimientos_bancarios')
        .select('*, estatus_conciliacion_bancaria(*)')
        .order('fecha', { ascending: false });
      setMovimientos(movs || []);

      // 8. Catálogo de estatus
      const token = await getSessionToken();
      const { catalog: catalogData } = await getEstatusCatalog(token);
      if (catalogData) {
        setEstatusCatalog(catalogData);
      }

      // 9. Métodos de Pago
      const { data: fpData } = await supabase
        .from('formas_pago')
        .select('*')
        .order('nombre', { ascending: true });
      setFormasPago(fpData || []);

      // 12. Cuentas Bancarias
      const { data: ctasData } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .order('nombre', { ascending: true });
      setCuentasBancarias(ctasData || []);

    } catch (err: unknown) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {`;

// The broken state starts around line 150 where "interface GastoFacturado {" was mistakenly inserted inside AdvancedBillingModule
const brokenStartPattern = /interface GastoFacturado \{[\s\S]*?const init = async \(\) => \{/;

if (brokenStartPattern.test(content)) {
    content = content.replace(brokenStartPattern, originalBlock + "\n    const init = async () => {");
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed successfully');
} else {
    console.log('Pattern not found, maybe it was modified differently?');
}
