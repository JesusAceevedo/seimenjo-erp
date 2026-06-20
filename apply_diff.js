const fs = require('fs');

const diffText = fs.readFileSync('diff_utf8.txt', 'utf8');
let pageContent = fs.readFileSync('app/admin/gastos/page.tsx', 'utf8');

const hunks = diffText.split(/^@@ /m).slice(1);

for (const hunk of hunks) {
  const lines = hunk.split('\n');
  const contextBefore = [];
  const deletions = [];
  const additions = [];
  let currentMode = 'context';
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('-')) {
      deletions.push(line.substring(1));
    } else if (line.startsWith('+')) {
      additions.push(line.substring(1));
    } else if (line.startsWith(' ')) {
      if (deletions.length > 0) break; // End of chunk context
      contextBefore.push(line.substring(1));
    }
  }
  
  // Create search string
  const searchStr = contextBefore.concat(deletions).join('\n');
  const replaceStr = contextBefore.concat(additions).join('\n');
  
  if (pageContent.includes(searchStr)) {
    pageContent = pageContent.replace(searchStr, replaceStr);
  } else {
    console.log("Could not find chunk:", contextBefore[0]);
  }
}

fs.writeFileSync('app/admin/gastos/page.tsx', pageContent, 'utf8');
console.log("Applied diff!");
