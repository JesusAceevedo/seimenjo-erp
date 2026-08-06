'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  Search,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency } from '../../../../lib/formatters';

export interface TransaccionBancaria {
  id: string;
  fecha: string;
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
  saldo: number;
  tipo: 'deposito' | 'retiro';
}

export default function ConversorEstadoCuenta() {
  const [file, setFile] = useState<File | null>(null);
  const [bancoSeleccionado, setBancoSeleccionado] = useState<string>('bbva');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [transacciones, setTransacciones] = useState<TransaccionBancaria[]>([]);
  const [busqueda, setBusqueda] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar PDF.js dinámicamente desde CDN si no está cargado
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    };
    document.head.appendChild(script);
  }, []);

  // Función para procesar el PDF cargado
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
      setErrorMsg('Por favor selecciona un archivo PDF válido de estado de cuenta.');
      return;
    }
    setFile(selectedFile);
    setErrorMsg('');
    await parsePdfEstadoCuenta(selectedFile);
  };

  const parsePdfEstadoCuenta = async (pdfFile: File) => {
    setIsProcessing(true);
    setProgressText('Leyendo documento PDF...');
    setErrorMsg('');

    try {
      if (!(window as any).pdfjsLib) {
        throw new Error('La librería PDF.js aún se está cargando. Por favor reintenta en unos segundos.');
      }

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfjsLib = (window as any).pdfjsLib;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;

      const totalPages = pdfDoc.numPages;
      const allLines: { y: number; x: number; text: string; page: number }[] = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgressText(`Extrayendo texto de página ${pageNum} de ${totalPages}...`);
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Agrupar elementos de texto por posición Y para reconstruir líneas de tabla
        const items = textContent.items as any[];
        items.forEach((item) => {
          if (!item.str || !item.str.trim()) return;
          const transform = item.transform;
          const x = transform[4];
          const y = transform[5];
          allLines.push({
            y: Math.round(y * 10) / 10,
            x: Math.round(x * 10) / 10,
            text: item.str.trim(),
            page: pageNum
          });
        });
      }

      setProgressText('Identificando y procesando movimientos bancarios...');
      const extractedRows = processPdfTextItems(allLines);

      if (extractedRows.length === 0) {
        throw new Error(
          'No se pudieron extraer movimientos automáticos. Asegúrate de que el PDF sea un estado de cuenta con capa de texto (no una imagen escaneada).'
        );
      }

      setTransacciones(extractedRows);
      setProgressText('');
    } catch (err: any) {
      console.error('Error al parsear estado de cuenta:', err);
      setErrorMsg(err.message || 'Ocurrió un error al procesar el archivo PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Algoritmo de agrupación espacial y parsing de movimientos
  const processPdfTextItems = (
    items: { y: number; x: number; text: string; page: number }[]
  ): TransaccionBancaria[] => {
    // 1. Detectar posiciones X de columnas de encabezado por página (CARGOS, ABONOS, SALDO)
    const pageHeaderCols: { [page: number]: { xCargos?: number; xAbonos?: number; xSaldo?: number } } = {};

    items.forEach((item) => {
      const txtUpper = item.text.toUpperCase();
      if (!pageHeaderCols[item.page]) pageHeaderCols[item.page] = {};

      if (txtUpper === 'CARGOS' || txtUpper === 'RETIROS' || txtUpper === 'CARGO') {
        pageHeaderCols[item.page].xCargos = item.x;
      } else if (txtUpper === 'ABONOS' || txtUpper === 'DEPOSITOS' || txtUpper === 'DEPÓSITOS' || txtUpper === 'ABONO') {
        pageHeaderCols[item.page].xAbonos = item.x;
      } else if (txtUpper === 'SALDO' || txtUpper.startsWith('SALDO ')) {
        pageHeaderCols[item.page].xSaldo = item.x;
      }
    });

    // 2. Agrupar por página y por línea Y (con tolerancia de ~3.5pt)
    const pageGroups: { [page: number]: { [lineKey: string]: { x: number; text: string }[] } } = {};

    items.forEach((item) => {
      if (!pageGroups[item.page]) pageGroups[item.page] = {};
      let foundKey = Object.keys(pageGroups[item.page]).find(
        (yKey) => Math.abs(Number(yKey) - item.y) <= 3.5
      );
      if (!foundKey) {
        foundKey = String(item.y);
        pageGroups[item.page][foundKey] = [];
      }
      pageGroups[item.page][foundKey].push({ x: item.x, text: item.text });
    });

    const parsedTransactions: TransaccionBancaria[] = [];
    const dateRegexBBVA = /^(\d{2}\/[A-Z]{3}|\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2})$/i;
    const dateRegexGeneric = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{2}[\/\-][A-Z]{3})$/i;

    let transactionCounter = 0;

    Object.keys(pageGroups).forEach((pageStr) => {
      const pageNum = Number(pageStr);
      const linesMap = pageGroups[pageNum];
      const headerCols = pageHeaderCols[pageNum] || {};
      const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);

      sortedY.forEach((yKey) => {
        const lineItems = linesMap[yKey].sort((a, b) => a.x - b.x);
        const fullLineStr = lineItems.map((i) => i.text).join(' ');

        if (
          fullLineStr.toUpperCase().includes('ESTADO DE CUENTA') ||
          fullLineStr.toUpperCase().includes('SALDO ANTERIOR') ||
          fullLineStr.toUpperCase().includes('TOTAL DE DEPOSITOS') ||
          fullLineStr.toUpperCase().includes('TOTAL DE CARGOS') ||
          fullLineStr.toUpperCase().includes('PAGINA') ||
          fullLineStr.toUpperCase().includes('HOJA') ||
          (fullLineStr.toUpperCase().includes('FECHA') && fullLineStr.toUpperCase().includes('CONCEPTO')) ||
          (fullLineStr.toUpperCase().includes('CARGOS') && fullLineStr.toUpperCase().includes('ABONOS'))
        ) {
          // Si es una línea de continuación de la descripción del movimiento anterior
          if (
            parsedTransactions.length > 0 &&
            !fullLineStr.toUpperCase().includes('ESTADO DE CUENTA') &&
            !fullLineStr.toUpperCase().includes('PAGINA') &&
            !fullLineStr.toUpperCase().includes('CARGOS')
          ) {
            const lastTx = parsedTransactions[parsedTransactions.length - 1];
            if (fullLineStr.length < 120 && !dateRegexBBVA.test(lineItems[0]?.text || '')) {
              lastTx.concepto += ' ' + fullLineStr.trim();
              const refMatch = lastTx.concepto.match(/(?:REF|FOLIO|AUT|NOMINA|TALON|TRAN|CVE)[:\s]*([A-Z0-9]{4,20})/i);
              if (refMatch) lastTx.referencia = refMatch[1];
            }
          }
          return;
        }

        const firstToken = lineItems[0]?.text || '';
        const secondToken = lineItems[1]?.text || '';
        const combinedFirstTwo = `${firstToken} ${secondToken}`.trim();

        let dateFound = '';
        let restTokens: { x: number; text: string }[] = [];

        if (dateRegexBBVA.test(firstToken) || dateRegexGeneric.test(firstToken)) {
          dateFound = firstToken;
          restTokens = lineItems.slice(1);
        } else if (dateRegexBBVA.test(combinedFirstTwo) || dateRegexGeneric.test(combinedFirstTwo)) {
          dateFound = combinedFirstTwo;
          restTokens = lineItems.slice(2);
        }

        if (!dateFound) {
          // Es una sub-línea complementaria de la descripción anterior
          if (parsedTransactions.length > 0) {
            const lastTx = parsedTransactions[parsedTransactions.length - 1];
            const cleanText = lineItems.map((i) => i.text).join(' ').trim();
            if (cleanText && !cleanText.toUpperCase().includes('TOTAL') && cleanText.length < 120) {
              lastTx.concepto += ' ' + cleanText;
              const refMatch = lastTx.concepto.match(/(?:REF|FOLIO|AUT|NOMINA|TALON|TRAN|CVE)[:\s]*([A-Z0-9]{4,20})/i);
              if (refMatch) lastTx.referencia = refMatch[1];
            }
          }
          return;
        }

        const numberTokens: { x: number; val: number; raw: string; hasDecimal: boolean }[] = [];
        const conceptTokens: string[] = [];

        restTokens.forEach((t) => {
          const rawStr = t.text.trim();
          const cleanVal = rawStr.replace(/[\$\s]/g, '').replace(/,/g, '');
          const hasDecimal = cleanVal.includes('.');

          if (/^-?\d+(\.\d{1,2})?$/.test(cleanVal)) {
            const num = parseFloat(cleanVal);
            if (!isNaN(num)) {
              // Si es un entero de 5+ dígitos sin punto decimal (ej. 174663275, 144663275), es un Folio/Referencia, NO un monto
              if (!hasDecimal && Math.abs(num) >= 100000) {
                conceptTokens.push(t.text);
                return;
              }
              numberTokens.push({ x: t.x, val: num, raw: t.text, hasDecimal });
              return;
            }
          }
          conceptTokens.push(t.text);
        });

        if (numberTokens.length === 0) return;

        let cargo = 0;
        let abono = 0;
        let saldo = 0;

        const conceptUpper = conceptTokens.join(' ').toUpperCase();
        const isSalesOrDepositKeyword =
          conceptUpper.includes('VENTA') ||
          conceptUpper.includes('VENTAS') ||
          conceptUpper.includes('DEPOSITO') ||
          conceptUpper.includes('DEPÓSITO') ||
          conceptUpper.includes('ABONO') ||
          conceptUpper.includes('SPEI RECIBIDO') ||
          conceptUpper.includes('RECEPCION') ||
          conceptUpper.includes('PAGO RECIBIDO') ||
          conceptUpper.includes('INGRESO') ||
          conceptUpper.includes('CORTE') ||
          conceptUpper.includes('REEMBOLSO') ||
          conceptUpper.includes('V42') ||
          conceptUpper.includes('V47') ||
          conceptUpper.includes('TDC') ||
          conceptUpper.includes('TDB');

        const isExpenseKeyword =
          conceptUpper.includes('IVA') ||
          conceptUpper.includes('TASA DE DESC') ||
          conceptUpper.includes('COMISION') ||
          conceptUpper.includes('COMISIÓN') ||
          conceptUpper.includes('COMPRA') ||
          conceptUpper.includes('RETIRO') ||
          conceptUpper.includes('CARGO') ||
          conceptUpper.includes('SPEI ENVIADO') ||
          conceptUpper.includes('DISPOSICION') ||
          conceptUpper.includes('PAGO DE') ||
          conceptUpper.includes('NOMINA');

        // Si tenemos detección de columnas por encabezado
        if (headerCols.xCargos && headerCols.xAbonos) {
          const midCargosAbonos = (headerCols.xCargos + headerCols.xAbonos) / 2;
          const midAbonosSaldo = headerCols.xSaldo
            ? (headerCols.xAbonos + headerCols.xSaldo) / 2
            : headerCols.xAbonos + 45;

          numberTokens.forEach((t) => {
            if (headerCols.xSaldo && Math.abs(t.x - headerCols.xSaldo) < 35) {
              saldo = t.val;
            } else if (t.x >= midCargosAbonos && t.x < midAbonosSaldo) {
              abono = Math.abs(t.val);
            } else if (t.x < midCargosAbonos) {
              cargo = Math.abs(t.val);
            } else {
              // Si está después de abonos/saldo, asignar a saldo o abono según cercanía
              if (headerCols.xSaldo && t.x >= midAbonosSaldo) {
                saldo = t.val;
              } else {
                abono = Math.abs(t.val);
              }
            }
          });
        } else {
          // Clasificación por número de tokens y palabras clave
          if (numberTokens.length >= 3) {
            cargo = Math.abs(numberTokens[0].val);
            abono = Math.abs(numberTokens[1].val);
            saldo = numberTokens[2].val;
          } else if (numberTokens.length === 2) {
            const firstNum = numberTokens[0].val;
            const secondNum = numberTokens[1].val;

            let isAbono = isSalesOrDepositKeyword && !isExpenseKeyword;
            if (isAbono) {
              abono = Math.abs(firstNum);
            } else {
              cargo = Math.abs(firstNum);
            }
            saldo = secondNum;
          } else if (numberTokens.length === 1) {
            const num = numberTokens[0].val;
            let isAbono = isSalesOrDepositKeyword && !isExpenseKeyword;
            if (isAbono) {
              abono = Math.abs(num);
            } else {
              cargo = Math.abs(num);
            }
          }
        }

        const tipo: 'deposito' | 'retiro' = abono > 0 ? 'deposito' : 'retiro';
        const concepto = conceptTokens.join(' ') || 'Movimiento bancario';
        const refMatch = concepto.match(/(?:REF|FOLIO|AUT|NOMINA|TALON|TRAN|CVE)[:\s]*([A-Z0-9]{4,20})/i);
        const referencia = refMatch ? refMatch[1] : '';

        transactionCounter++;
        parsedTransactions.push({
          id: `tx_${transactionCounter}_${Date.now()}`,
          fecha: dateFound,
          concepto,
          referencia,
          cargo: Math.abs(cargo),
          abono: Math.abs(abono),
          saldo,
          tipo
        });
      });
    });

    return parsedTransactions;
  };

  const handleCellChange = (id: string, field: keyof TransaccionBancaria, value: any) => {
    setTransacciones((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, [field]: value };
        if (field === 'cargo' || field === 'abono') {
          updated.tipo = Number(updated.abono) > 0 ? 'deposito' : 'retiro';
        }
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setTransacciones((prev) => prev.filter((t) => t.id !== id));
  };

  const exportToExcel = () => {
    if (transacciones.length === 0) return;

    const dataToExport = transacciones.map((t, idx) => ({
      '#': idx + 1,
      'Fecha': t.fecha,
      'Concepto / Descripción': t.concepto,
      'Referencia': t.referencia || '-',
      'Cargo / Retiro ($)': t.cargo > 0 ? t.cargo : 0,
      'Abono / Depósito ($)': t.abono > 0 ? t.abono : 0,
      'Saldo Acumulado ($)': t.saldo > 0 ? t.saldo : 0
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    ws['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 45 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estado de Cuenta');

    const fileName = file
      ? `Estado_Cuenta_${file.name.replace(/\.[^/.]+$/, '')}.xlsx`
      : 'Estado_Cuenta_Convertido.xlsx';

    XLSX.writeFile(wb, fileName);
  };

  const exportToCSV = () => {
    if (transacciones.length === 0) return;

    const headers = ['#', 'Fecha', 'Concepto', 'Referencia', 'Cargo', 'Abono', 'Saldo'];
    const rows = transacciones.map((t, idx) => [
      idx + 1,
      `"${t.fecha}"`,
      `"${t.concepto.replace(/"/g, '""')}"`,
      `"${t.referencia || ''}"`,
      t.cargo || 0,
      t.abono || 0,
      t.saldo || 0
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      file ? `Estado_Cuenta_${file.name.replace(/\.[^/.]+$/, '')}.csv` : 'Estado_Cuenta_Convertido.csv'
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const transaccionesFiltradas = transacciones.filter((t) => {
    if (!busqueda.trim()) return true;
    const b = busqueda.toLowerCase();
    return (
      t.fecha.toLowerCase().includes(b) ||
      t.concepto.toLowerCase().includes(b) ||
      t.referencia.toLowerCase().includes(b) ||
      String(t.cargo).includes(b) ||
      String(t.abono).includes(b)
    );
  });

  const totalDepositos = transacciones.reduce((acc, t) => acc + (Number(t.abono) || 0), 0);
  const totalRetiros = transacciones.reduce((acc, t) => acc + (Number(t.cargo) || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* TARJETA SUPERIOR DE INFORMACIÓN / CABECERA */}
      <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-955/40 text-amber-500 rounded-xl border border-amber-200 dark:border-amber-900/40">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Conversor de Estados de Cuenta PDF a Excel
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Extrae automáticamente los movimientos bancarios de tus archivos PDF (BBVA México, BBVA Net Cash y otros bancos) y genéralos en formato Excel (.xlsx).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Banco:</span>
            <select
              value={bancoSeleccionado}
              onChange={(e) => setBancoSeleccionado(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="bbva">BBVA México / Net Cash</option>
              <option value="banamex">Citibanamex</option>
              <option value="santander">Santander</option>
              <option value="banregio">Banregio</option>
              <option value="generico">Genérico (Detección automática)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ÁREA DE CARGA DE ARCHIVO PDF */}
      <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-500 dark:hover:border-amber-500 transition-all rounded-xl p-8 text-center cursor-pointer bg-gray-50/50 dark:bg-gray-900/30 flex flex-col items-center justify-center gap-3 group"
        >
          <div className="p-4 bg-amber-100 dark:bg-amber-955/50 text-amber-600 dark:text-amber-400 rounded-full group-hover:scale-110 transition-all">
            <UploadCloud size={32} />
          </div>
          <div>
            <p className="text-sm font-extrabold text-gray-800 dark:text-gray-200">
              {file ? file.name : 'Haz clic aquí o arrastra tu estado de cuenta en formato PDF'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Soporta documentos PDF nativos emitidos por la banca digital (BBVA, Banamex, Santander, etc.)
            </p>
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-md transition-all mt-1"
          >
            Seleccionar Archivo PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* ESTADO DE PROCESAMIENTO / ERRORES */}
        {isProcessing && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-955/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-center gap-3 text-blue-600 dark:text-blue-400 text-xs font-bold animate-pulse">
            <RefreshCw size={18} className="animate-spin shrink-0" />
            <span>{progressText}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-955/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-xs font-semibold">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Error en la lectura del estado de cuenta</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* RESULTADOS Y TABLA DE MOVIMIENTOS EXTRÁIDOS */}
      {transacciones.length > 0 && (
        <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
          {/* TARJETAS RESUMEN DE EXTRACCIÓN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                <span>Movimientos extraídos</span>
                <FileText size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {transacciones.length}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-955/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
              <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                <span>Total Depósitos (+)</span>
                <ArrowUpRight size={18} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                +{formatCurrency(totalDepositos)}
              </p>
            </div>

            <div className="p-4 bg-red-50/50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/40 rounded-xl">
              <div className="flex justify-between items-center text-xs text-red-650 dark:text-red-400 font-bold uppercase">
                <span>Total Retiros (-)</span>
                <ArrowDownRight size={18} className="text-red-500" />
              </div>
              <p className="text-2xl font-black text-red-650 dark:text-red-400 mt-1 font-mono">
                -{formatCurrency(totalRetiros)}
              </p>
            </div>
          </div>

          {/* BARRA DE HERRAMIENTAS: BÚSQUEDA Y BOTONES DE DESCARGA EXCEL */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por fecha, concepto o monto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={exportToCSV}
                className="flex-1 sm:flex-initial px-3.5 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download size={14} /> CSV
              </button>

              <button
                type="button"
                onClick={exportToExcel}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet size={15} /> Descargar en Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* TABLA EDITABLE DE MOVIMIENTOS */}
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 w-28">Fecha</th>
                  <th className="p-3">Concepto / Descripción</th>
                  <th className="p-3 w-32">Referencia</th>
                  <th className="p-3 text-right w-28">Retiro (-)</th>
                  <th className="p-3 text-right w-28">Abono (+)</th>
                  <th className="p-3 text-right w-28">Saldo</th>
                  <th className="p-3 text-center w-12">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {transaccionesFiltradas.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-all">
                    <td className="p-3 text-center text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={t.fecha}
                        onChange={(e) => handleCellChange(t.id, 'fecha', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-amber-500 rounded px-1.5 py-1 text-xs font-mono text-gray-800 dark:text-gray-200 outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={t.concepto}
                        onChange={(e) => handleCellChange(t.id, 'concepto', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-amber-500 rounded px-1.5 py-1 text-xs text-gray-900 dark:text-white outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={t.referencia}
                        onChange={(e) => handleCellChange(t.id, 'referencia', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-amber-500 rounded px-1.5 py-1 text-xs font-mono text-gray-500 outline-none"
                        placeholder="Sin ref"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={t.cargo || ''}
                        onChange={(e) => handleCellChange(t.id, 'cargo', parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-amber-500 rounded px-1.5 py-1 text-xs text-right font-mono font-bold text-red-650 dark:text-red-400 outline-none"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={t.abono || ''}
                        onChange={(e) => handleCellChange(t.id, 'abono', parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-amber-500 rounded px-1.5 py-1 text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2 text-right font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                      {formatCurrency(t.saldo)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(t.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Eliminar fila"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
