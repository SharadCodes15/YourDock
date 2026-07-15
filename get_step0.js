const fs = require('fs');
const readline = require('readline');

async function getStep0() {
  const fileStream = fs.createReadStream('C:\\Users\\shara\\.gemini\\antigravity\\brain\\62cb94a7-3d93-48fe-b6c2-1d48e7895f6c\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"step_index":0}')) { // Step 0 has no preceding index or is formatted differently
      const obj = JSON.parse(line);
      fs.writeFileSync('e:/sideProjects/dock/step0_full.txt', obj.content, 'utf8');
      console.log('Done!');
      break;
    }
    // Alternatively, let's just find the first USER_INPUT
    if (line.includes('"type":"USER_INPUT"')) {
      const obj = JSON.parse(line);
      fs.writeFileSync('e:/sideProjects/dock/step0_full.txt', obj.content, 'utf8');
      console.log('Done (first input)!');
      break;
    }
  }
}

getStep0();
