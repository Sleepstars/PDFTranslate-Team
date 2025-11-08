#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');

const nextBin = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');

const child = spawn(nextBin, ['build', '--webpack'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
  },
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
