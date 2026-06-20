const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

// Use string replacement safely
const oldStr = `              <BancoTab
                bancoSubTab={bancoSubTab}
                setBancoSubTab={setBancoSubTab}
                cuentasBancarias={cuentasBancarias}`;

const newStr = `              <BancoTab
                bancoSubTab={bancoSubTab}
                setBancoSubTab={setBancoSubTab}
                cuentasBancarias={cuentasBancarias}
                gastosFacturados={gastosFacturados}
                ventasFacturadas={ventasFacturadas}`;

pageContent = pageContent.replace(oldStr, newStr);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log("Updated page.tsx safely");
