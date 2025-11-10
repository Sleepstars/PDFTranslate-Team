#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use bun to run next directly
const child = spawn('bun', ['run', 'next', 'build', '--webpack'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
  },
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
