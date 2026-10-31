const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'generated');
const dest = path.join(__dirname, '..', '..', 'dist', 'generated');

if (fs.existsSync(src)) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('✓ Successfully copied generated folder to dist');
} else {
  console.log('Notice: src/generated does not exist, skipping copy.');
}
