const fs = require('fs');

const pageFile = 'app/admin/gastos/page.tsx';
let pageContent = fs.readFileSync(pageFile, 'utf8');

// The end of the file is:
//       )}
//       </div>
//     </div>
//   );
// }

// Let's replace the last 5 lines with one less div:
pageContent = pageContent.replace(
  /\)\}\r?\n\s*<\/div>\r?\n\s*<\/div>\r?\n\s*\);\r?\n\s*\}/,
  ')}\n    </div>\n  );\n}'
);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log("Removed extra div");
