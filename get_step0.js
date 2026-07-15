const fs = require('fs');
const path = require('path');
const readline = require('readline');

function getTranscriptPath() {
  const candidates = [
    process.env.ANTIGRAVITY_TRANSCRIPT_PATH,
    path.join(process.cwd(), 'transcript.jsonl'),
    path.join(process.cwd(), 'logs', 'transcript.jsonl')
  ];

  return candidates.find(Boolean);
}

async function getStep0() {
  const transcriptPath = getTranscriptPath();
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    console.error('Transcript file not found. Set ANTIGRAVITY_TRANSCRIPT_PATH or place transcript.jsonl in the working directory.');
    return;
  }

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"step_index":0}')) {
      const obj = JSON.parse(line);
      const outputPath = path.join(process.cwd(), 'step0_full.txt');
      fs.writeFileSync(outputPath, obj.content, 'utf8');
      console.log(`Done! Wrote ${outputPath}`);
      break;
    }
    if (line.includes('"type":"USER_INPUT"')) {
      const obj = JSON.parse(line);
      const outputPath = path.join(process.cwd(), 'step0_full.txt');
      fs.writeFileSync(outputPath, obj.content, 'utf8');
      console.log(`Done (first input)! Wrote ${outputPath}`);
      break;
    }
  }
}

getStep0();
