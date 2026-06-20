const fs = require('fs');

const content = fs.readFileSync('app/admin/gastos/page.tsx', 'utf8');

// Simple regex to count divs. Not perfect but gives an idea
const openDivs = (content.match(/<div(\s|>)/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;

console.log(`Open divs: ${openDivs}, Close divs: ${closeDivs}, Difference: ${openDivs - closeDivs}`);
