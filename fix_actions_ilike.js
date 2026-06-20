const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'actions.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace lowercased eq checks with ilike checks for UUIDs
content = content.replace(
  /\.eq\('uuid_fiscal', xmlData\.uuid\.toLowerCase\(\)\)/g,
  `.ilike('uuid_fiscal', xmlData.uuid)`
);

// We can keep the inserts lowercased or revert them to original, let's keep them original to be safe 
// in case other parts of the app rely on original case
content = content.replace(
  /uuid_fiscal: xmlData\.uuid\.toLowerCase\(\),/g,
  `uuid_fiscal: xmlData.uuid.toUpperCase(),`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed actions.ts for case-insensitive UUID matching using ilike');
