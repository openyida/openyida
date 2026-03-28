const fs = require('fs');
const path = require('path');

const requiredDirs = ['bin', 'lib', 'project', 'yida-skills', 'scripts'];
const requiredFiles = [
  'bin/yida.js',
  'package.json',
  'project/config.json',
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  '.eslintrc.json',
];

let hasError = false;

for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    console.error('Missing directory: ' + dir);
    hasError = true;
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error('Missing file: ' + file);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

// Validate package.json engines field
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const nodeEngine = packageJson.engines && packageJson.engines.node;
if (!nodeEngine) {
  console.error('package.json missing engines.node field');
  process.exit(1);
}
console.log('engines.node: ' + nodeEngine);

const skillsDir = 'yida-skills/skills';
if (fs.existsSync(skillsDir)) {
  const skills = fs.readdirSync(skillsDir).filter(function(name) {
    return fs.statSync(path.join(skillsDir, name)).isDirectory();
  });
  console.log('yida-skills sub-skills: ' + skills.length);
}

function countJsFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.isDirectory()) {
      count += countJsFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith('.js')) {
      count++;
    }
  }
  return count;
}
console.log('lib/ modules: ' + countJsFiles('lib'));
console.log('Project structure OK');
