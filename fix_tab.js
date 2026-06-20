const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\|\| activeTab === 'proveedores'/g,
  ''
);

// We need to make sure we have exactly the right amount of closing divs at the end.
// We previously removed `<div className="..."> ... </div></div></div>` at the end of the Proveedor Modal.
// The file should end with the Email Modal, which is right before the very end.
content = content.replace(
  /          <\/div>\r?\n\r?\n        <\/div>\r?\n\r?\n      \{\/\* MODAL SIMULACION CORREO \*\/\}/g,
  `          </div>\n        </div>\n      {/* MODAL SIMULACION CORREO */}`
);

// If the two closing divs were deleted by fix_page.js, we add them back.
// Let's check if `{/* MODAL SIMULACION CORREO */}` is preceded by `</div>`.
if (!content.includes(`</div>\n        </div>\n\n      {/* MODAL SIMULACION CORREO */}`)) {
    content = content.replace(
        /\{\/\* MODAL SIMULACION CORREO \*\/\}/,
        `    </div>\n  </div>\n\n  {/* MODAL SIMULACION CORREO */}`
    );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed tabs and divs.');
