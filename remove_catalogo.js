const fs = require('fs');

const tabPath = 'app/admin/gastos/_components/BancoTab.tsx';
let content = fs.readFileSync(tabPath, 'utf8');

// 1. Update BancoTabProps
content = content.replace(
  /bancoSubTab: 'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago';/,
  "bancoSubTab: 'movimientos' | 'global';"
);
content = content.replace(
  /setBancoSubTab: \(sub: 'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago'\) \=\> void;/,
  "setBancoSubTab: (sub: 'movimientos' | 'global') => void;"
);

// 2. Remove buttons
content = content.replace(
  /\{\s*key:\s*'catalogo'[\s\S]*?\},\s*/g,
  ""
);
content = content.replace(
  /\{\s*key:\s*'formas_pago'[\s\S]*?\},\s*/g,
  ""
);

// 3. Remove {bancoSubTab === 'catalogo' && ( ... )}
function removeBlock(str, prefix) {
  const startIdx = str.indexOf(prefix);
  if (startIdx === -1) return str;
  
  let openBraces = 0;
  let endIdx = startIdx;
  let started = false;
  
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') {
      openBraces++;
      started = true;
    }
    if (str[i] === '}') {
      openBraces--;
      if (started && openBraces === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  // also delete the preceding comment if it exists
  const prevComment = str.lastIndexOf("{/*", startIdx);
  if (prevComment !== -1 && (startIdx - prevComment) < 200) {
    return str.substring(0, prevComment) + str.substring(endIdx);
  }
  
  return str.substring(0, startIdx) + str.substring(endIdx);
}

content = removeBlock(content, "{bancoSubTab === 'catalogo' && (");
content = removeBlock(content, "{bancoSubTab === 'formas_pago' && (");

fs.writeFileSync(tabPath, content, 'utf8');
console.log("BancoTab refactored perfectly");
