'use strict';
// Собирает веб-клиент (vite build в корне проекта) и копирует dist -> desktop/web
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const out = path.resolve(__dirname, '..', 'web');

if (!fs.existsSync(path.join(root, 'node_modules'))) {
  console.log('> npm install (корень проекта)');
  execSync('npm install', { cwd: root, stdio: 'inherit' });
}

console.log('> vite build');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'dist'), out, { recursive: true });

if (!fs.existsSync(path.join(out, 'index.html'))) {
  throw new Error('Сборка не создала index.html');
}
console.log('> веб-клиент скопирован в desktop/web');
