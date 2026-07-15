const fs = require('fs');
const readline = require('readline');

async function getStep() {
  const fileStream = fs.createReadStream('C:\\Users\\shara\\.gemini\\antigravity\\brain\\62cb94a7-3d93-48fe-b6c2-1d48e7895f6c\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"step_index":636')) {
      const obj = JSON.parse(line);
      fs.writeFileSync('e:/sideProjects/dock/original_request_full.txt', obj.content, 'utf8');
      console.log('Done!');
      break;
    }
  }
}

getStep();
