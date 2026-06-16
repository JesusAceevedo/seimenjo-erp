/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').replace(/['"\r]/g, '').trim();
  }
});

const baseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL.trim();
const apiKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const url = baseUrl + '/rest/v1/';

console.log("Parsed URL:", JSON.stringify(baseUrl));
console.log("Parsed Anon Key Length:", apiKey.length);
console.log("Fetching OpenAPI spec from:", url);

fetch(url, {
  headers: {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  }
})
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  })
  .then(swagger => {
    console.log("OpenAPI Spec fetched successfully!");
    const paths = Object.keys(swagger.paths || {});
    console.log("Exposed Tables/Views:");
    const tables = new Set();
    paths.forEach(p => {
      const table = p.split('/')[1];
      if (table && table !== '') {
        tables.add(table);
      }
    });
    console.log(Array.from(tables).join('\n'));

    console.log("\nTable Details (Definitions):");
    const definitions = swagger.definitions || {};
    Object.keys(definitions).forEach(tableName => {
      console.log(`\nTable: ${tableName}`);
      const properties = definitions[tableName].properties || {};
      const cols = Object.keys(properties).map(colName => {
        const prop = properties[colName];
        return `${colName} (${prop.type}${prop.format ? ', ' + prop.format : ''}${prop.description ? ', ' + prop.description : ''})`;
      });
      console.log("  Columns:\n    " + cols.join('\n    '));
    });
  })
  .catch(err => {
    console.error("Error fetching OpenAPI spec:", err);
  });
