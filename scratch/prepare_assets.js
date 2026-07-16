const fs = require('node:fs');
const path = require('node:path');

const srcPng = "C:\\Users\\shara\\.gemini\\antigravity\\brain\\0d71e4c7-7769-4163-9150-340f9dd8f46d\\app_dock_icon_1784187871961.png";
const buildDir = path.join(__dirname, '..', 'build');
const destPng = path.join(buildDir, 'icon.png');
const destIco = path.join(buildDir, 'icon.ico');

function main() {
  if (!fs.existsSync(srcPng)) {
    console.error('Source PNG not found at:', srcPng);
    process.exit(1);
  }

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Copy PNG to build/icon.png
  fs.copyFileSync(srcPng, destPng);
  console.log('Copied PNG to:', destPng);

  // Read PNG data
  const pngData = fs.readFileSync(destPng);
  const pngSize = pngData.length;

  // Create ICO header and directory entry (22 bytes)
  const icoHeader = Buffer.alloc(22);
  
  // Header: Reserved (2), Type (2), Count (2)
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 (Icon)
  icoHeader.writeUInt16LE(1, 4); // 1 Image

  // Directory Entry
  icoHeader.writeUInt8(0, 6);   // Width 256 (0 means 256)
  icoHeader.writeUInt8(0, 7);   // Height 256 (0 means 256)
  icoHeader.writeUInt8(0, 8);   // Color count (0 for >= 256 colors)
  icoHeader.writeUInt8(0, 9);   // Reserved
  icoHeader.writeUInt16LE(1, 10); // Color planes
  icoHeader.writeUInt16LE(32, 12); // Bits per pixel (32-bit RGBA)
  icoHeader.writeUInt32LE(pngSize, 14); // Size of PNG data
  icoHeader.writeUInt32LE(22, 18); // Offset where PNG data starts (header size)

  // Combine header and PNG data
  const icoData = Buffer.concat([icoHeader, pngData]);

  // Write ICO file
  fs.writeFileSync(destIco, icoData);
  console.log('Generated ICO file at:', destIco);
}

main();
