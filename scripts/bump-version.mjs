import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swPath = path.resolve(__dirname, '../sw.js');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;

try {
  let swContent = fs.readFileSync(swPath, 'utf8');
  const versionRegex = /const BUILD_VERSION = ['"][^'"]+['"];/;

  if (versionRegex.test(swContent)) {
    swContent = swContent.replace(versionRegex, `const BUILD_VERSION = '${version}';`);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`\x1b[32m✔ [MERIDIANO]\x1b[0m sw.js actualizado a la versión: \x1b[36m${version}\x1b[0m`);
  } else {
    console.error('\x1b[31m✖ [MERIDIANO]\x1b[0m No se encontró const BUILD_VERSION en sw.js');
    process.exit(1);
  }
} catch (error) {
  console.error('\x1b[31m✖ [MERIDIANO]\x1b[0m Error al actualizar versión:', error);
  process.exit(1);
}
