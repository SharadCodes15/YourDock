const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sensitivePatterns = [
  /C:\\Users\\[^\\]+/i,
  /E:\\sideProjects\\dock/i,
  /shara/i,
  /\.gemini\//i,
  /HomeWiFi_5G/i,
  /file:\/\/E:\//i
];

const filesToCheck = [
  'dock/apps.json',
  'get_request.js',
  'get_step0.js',
  'list_inputs.js',
  'index.html',
  'main.js',
  'dock/main.js'
];

let failures = [];
for (const relativePath of filesToCheck) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const pattern of sensitivePatterns) {
    if (pattern.test(content)) {
      failures.push(`${relativePath} contains sensitive pattern: ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error('Public-safety check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Public-safety check passed.');
