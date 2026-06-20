const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

// fix local interface
pageContent = pageContent.replace(
  /categorias_gasto\?:\s*\{\s*nombre:\s*string\s*\};/,
  `categorias_gasto?: { id: string; nombre: string } | null;`
);

// fix query
pageContent = pageContent.replace(
  /categorias_gasto\(nombre\)/g,
  `categorias_gasto(id, nombre)`
);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('Fixed TS errors in page.tsx');
