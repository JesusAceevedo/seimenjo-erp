const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /onSendEmail=\{handleSendEmail\}\s*busquedaBanco=\{busquedaBanco\}/;

const correctBlock = `onSendEmail={handleSendEmail}
              />
            )}

            {/* TAB 3: BANCO */}
            {activeTab === 'banco' && (
              <BancoTab
                bancoSubTab={bancoSubTab}
                setBancoSubTab={setBancoSubTab}
                cuentasBancarias={cuentasBancarias}
                movimientos={movimientos}
                estatusCatalog={estatusCatalog}
                formasPago={formasPago}
                pedidosPendientes={pedidosPendientes}
                gastosReconciliables={gastosReconciliables}
                busquedaBanco={busquedaBanco}`;

if (regex.test(content)) {
  content = content.replace(regex, correctBlock);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Fixed page.tsx");
} else {
  console.log("Regex not found");
}
