const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {}

const backendDir = path.resolve(__dirname, '..');
const possiblePaths = [
  path.resolve(backendDir, 'dist', 'src', 'main.js'),
  path.resolve(backendDir, 'dist', 'main.js'),
];

function findTarget() {
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

const targetFile = findTarget();

if (!targetFile) {
  console.error('[StartProd] FATAL: Compiled main.js not found in dist/. Please run "npm run build" before starting the production server.');
  process.exit(1);
}

console.log(`[StartProd] Booting production NestJS server from pre-compiled artifact: ${targetFile}`);

const child = spawn(process.execPath, [targetFile], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (err) => {
  console.error('[StartProd] Failed to start production server process:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`[StartProd] Server process exited with code ${code} and signal ${signal}`);
  }
  process.exit(code || 0);
});
