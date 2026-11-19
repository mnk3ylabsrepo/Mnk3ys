/**
 * Promote preview2 to the live site root (index.html) before deploy.
 * Keeps preview2/ as the editable source of truth.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'preview2', 'index.html');
const dest = path.join(root, 'index.html');

let html = fs.readFileSync(src, 'utf8');
html = html
  .replace(/\{\{SITE_URL\}\}\/preview2/g, '{{SITE_URL}}')
  .replace(/content="\{\{SITE_URL\}\}\/preview2"/g, 'content="{{SITE_URL}}"');

fs.writeFileSync(dest, html, 'utf8');
console.log('Promoted preview2/index.html → index.html');
