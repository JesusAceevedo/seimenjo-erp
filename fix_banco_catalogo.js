const fs = require('fs');

const tabPath = 'app/admin/gastos/_components/BancoTab.tsx';
let lines = fs.readFileSync(tabPath, 'utf8').split(/\r?\n/);

let catStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("bancoSubTab === 'catalogo'")) {
    catStart = i;
    break;
  }
}

if (catStart !== -1) {
  // Find the last </div>
  let lastDivs = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('</div>')) {
      lastDivs.unshift(lines[i]);
    }
    if (lines[i].includes(');')) {
      lastDivs.unshift(lines[i]);
    }
    if (lines[i].includes('}')) {
      if (i === lines.length - 1 || lines[i].trim() === '}') {
        lastDivs.unshift(lines[i]);
        break; // Stop at the main component's closing brace
      }
    }
  }
  
  // Actually, let's just keep the last 3 lines which are usually:
  //    </div>
  //  );
  // }
  
  const endLines = lines.slice(lines.length - 3);
  
  // Cut out the lines from catStart (actually catStart-1 for the comment) to length-3
  let newLines = lines.slice(0, catStart - 1).concat(endLines);
  
  fs.writeFileSync(tabPath, newLines.join('\n'), 'utf8');
  console.log("BancoTab catalogo deleted successfully");
} else {
  console.log("catalogo block not found!");
}
