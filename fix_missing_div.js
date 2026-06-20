const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

pageContent = pageContent.replace(
  /\s*<\/div>\r?\n\s*\);\r?\n\s*\}\r?\n?$/,
  '\n      </div>\n    </div>\n  );\n}\n'
);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log("Fixed missing div");
