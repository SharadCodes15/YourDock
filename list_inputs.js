const fs = require('fs');
const readline = require('readline');

async function listInputs() {
  const fileStream = fs.createReadStream('C:\\Users\\shara\\.gemini\\antigravity\\brain\\62cb94a7-3d93-48fe-b6c2-1d48e7895f6c\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let i = 0;
  for await (const line of rl) {
    if (line.includes('"type":"USER_INPUT"')) {
      const obj = JSON.parse(line);
      console.log(`Step ${obj.step_index}: ${obj.content.substring(0, 100)}...`);
    }
  }
}

listInputs();
