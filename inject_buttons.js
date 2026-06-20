const fs = require('fs');

function injectButton(path, findStr, color) {
  let content = fs.readFileSync(path, 'utf8');
  
  if (content.includes("Subir Facturas (XML)")) {
    console.log(`Button already in ${path}`);
    return;
  }
  
  const replacement = `
          <div className="flex gap-2">
            <button
              onClick={() => setShowXmlModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <UploadCloud size={13} /> Subir Facturas (XML)
            </button>
            <button
              onClick={${findStr}}
`;
  
  // replace `<button\n            onClick={onOpenComprobacionAcumulada}`
  // To be safe, let's use regex:
  const regexStr = `<button\\s+onClick=\\{${findStr}\\}`;
  const regex = new RegExp(regexStr);
  
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    // Note: the original button has `</button>`. Since we wrapped it in a div, we need to close the div!
    // But wait, the original was just a `<button ...> ... </button>`. We need to add `</div>` after `</button>`.
    
    // Instead of doing it this way, let's just find the original button block:
    // It's followed by `</button>\n        </div>`
    const btnEnd = content.indexOf('</button>', content.indexOf(findStr));
    if (btnEnd !== -1) {
      content = content.substring(0, btnEnd + 9) + '\n          </div>' + content.substring(btnEnd + 9);
    }
  }

  fs.writeFileSync(path, content, 'utf8');
  console.log(`Injected button into ${path}`);
}

injectButton('app/admin/gastos/_components/EgresosTab.tsx', 'onOpenComprobacionAcumulada', 'blue');
injectButton('app/admin/gastos/_components/IngresosTab.tsx', 'onOpenFacturacionAcumulada', 'emerald');
