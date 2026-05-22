/**
 * stamp-sw.cjs
 * Runs before every build (via "prebuild" npm hook).
 * Replaces the CACHE_NAME version token in public/sw.js with a fresh
 * build timestamp so every deployment automatically busts the old cache.
 */

const fs   = require('fs');
const path = require('path');

const swPath  = path.join(__dirname, '..', 'public', 'sw.js');
const version = `inscribed-${Date.now()}`;

let content = fs.readFileSync(swPath, 'utf8');

// Replace whatever the current cache version string is
content = content.replace(
  /const CACHE_NAME = '[^']+';/,
  `const CACHE_NAME = '${version}';`
);

fs.writeFileSync(swPath, content, 'utf8');
console.log(`[stamp-sw] ✓ Cache version stamped: ${version}`);
