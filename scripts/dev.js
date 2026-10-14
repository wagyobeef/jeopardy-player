import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['run', 'dev', '-w', 'server'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '-w', 'client'], { stdio: 'inherit' }),
];

function shutdown() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

for (const child of children) {
  child.on('exit', (code) => {
    if (code) {
      shutdown();
      process.exit(code);
    }
  });
}
