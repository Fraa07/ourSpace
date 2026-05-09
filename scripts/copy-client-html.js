const fs = require('fs');
const path = require('path');

const sourcePath = path.join('src', 'client', 'index.html');
const targetDirectory = path.join('build', 'public');
const targetPath = path.join(targetDirectory, 'index.html');

fs.mkdirSync(targetDirectory, { recursive: true });
fs.copyFileSync(sourcePath, targetPath);