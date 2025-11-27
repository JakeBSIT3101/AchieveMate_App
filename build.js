const { spawn } = require('child_process');
const path = require('path');

// Simulate EAS build by calling expo with prebuild
const expo = spawn('node', [path.join(__dirname, 'node_modules', 'expo', 'bin', 'cli.js'), 'build:android', '--profile', 'development'], {
  stdio: 'inherit',
  shell: true
});

expo.on('close', (code) => {
  console.log(`Build process exited with code ${code}`);
});
