/**
 * NotioAI Build Script
 * Her Netlify deploy'unda CSS/JS linklerindeki ?v= değerini
 * otomatik olarak günceller. Tarayıcı cache sorunu olmaz.
 */

const fs   = require('fs');
const path = require('path');

const version = Date.now(); // Örn: 1712000000000

function processDir(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      processDir(full);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(full, 'utf8');
      const updated = html.replace(/\?v=\d+/g, `?v=${version}`);
      if (updated !== html) {
        fs.writeFileSync(full, updated);
        console.log(`  ✓ ${full.replace(process.cwd(), '')}`);
      }
    }
  }
}

console.log(`\nBuilding NotioAI — CSS version: ${version}\n`);
processDir('.');
console.log('\nBuild complete.\n');
