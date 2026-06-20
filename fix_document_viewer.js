const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', '_components', 'DocumentViewer.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import { obtenerSignedUrl }")) {
  content = content.replace(
    /import \{ X, FileText, FileCode, Download, RefreshCw, AlertCircle \} from 'lucide-react';/,
    `import { X, FileText, FileCode, Download, RefreshCw, AlertCircle } from 'lucide-react';\nimport { obtenerSignedUrl } from '../gastos/actions';\nimport { supabase } from '../../../lib/supabase';`
  );
}

const effectReplacement = `  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || documents.length === 0) return;
    const activeDoc = documents[activeIndex];
    
    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setSignedPdfUrl(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Obtenemos la URL firmada para cualquier tipo de documento (PDF o XML)
        const res = await obtenerSignedUrl(activeDoc.url, token);
        if (!res.success || !res.url) {
          throw new Error('No se pudo obtener el archivo.');
        }

        if (activeDoc.type === 'xml') {
          const fetchRes = await fetch(res.url);
          if (!fetchRes.ok) throw new Error('Error al cargar el XML');
          const text = await fetchRes.text();
          setXmlContent(text);
        } else {
          // Es PDF, usamos la URL firmada en el iframe
          setSignedPdfUrl(res.url);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error desconocido al cargar el documento.');
      } finally {
        setLoading(false);
      }
    };

    loadDoc();
  }, [open, activeIndex, documents]);`;

content = content.replace(
  /  useEffect\(\(\) => \{\r?\n    if \(!open \|\| documents\.length === 0\) return;\r?\n    const activeDoc = documents\[activeIndex\];[\s\S]*?  \}, \[open, activeIndex, documents\]\);/,
  effectReplacement
);

// Replace iframe src to use signedPdfUrl
content = content.replace(
  /<iframe\r?\n\s*src=\{`\$\{activeDoc\.url\}#view=FitH`\}\r?\n\s*className="w-full h-full border-0"/,
  `<iframe\n                src={\`\${signedPdfUrl}#view=FitH\`}\n                className="w-full h-full border-0"`
);

// Replace download links to use signedPdfUrl or XML signed URL.
// But wait, we can just let it download the original URL? No, it's blocked by CORS/Auth.
// We should probably just use signedPdfUrl for download link if available.
content = content.replace(
  /href=\{activeDoc\?\.url\}/,
  `href={signedPdfUrl || '#'}`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed DocumentViewer");
