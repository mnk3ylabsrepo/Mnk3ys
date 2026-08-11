/** Preview UI at /preview — works on Vercel and localhost; live homepage unchanged. */

function sendPreviewHtml(res, rootDir) {
  const fs = require('fs');
  const path = require('path');
  try {
    const body = fs.readFileSync(path.join(rootDir, 'preview', 'index.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(body);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { sendPreviewHtml };
