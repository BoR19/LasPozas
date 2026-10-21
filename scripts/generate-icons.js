import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height) {
  // RGBA buffer with filter byte at start of each scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded app icon shape
      const inIconBox = (Math.abs(dx) < r && Math.abs(dy) < r);

      if (inIconBox) {
        // Water drop shape calculation:
        // top sharp point at (cx, cy - r * 0.55), round bottom at (cx, cy + r * 0.15)
        const dropTopY = cy - r * 0.45;
        const dropBottomY = cy + r * 0.18;
        const dropBottomR = r * 0.38;

        const dDropBottom = Math.sqrt((x - cx) ** 2 + (y - dropBottomY) ** 2);
        const inBottomCircle = dDropBottom <= dropBottomR;
        const inTopCone = (y >= dropTopY && y <= dropBottomY && Math.abs(x - cx) <= ((y - dropTopY) / (dropBottomY - dropTopY)) * dropBottomR);

        const inDrop = inBottomCircle || inTopCone;

        if (inDrop) {
          // White water droplet
          rawData[px] = 255;
          rawData[px + 1] = 255;
          rawData[px + 2] = 255;
          rawData[px + 3] = 255;
        } else {
          // Blue background (#2563eb = RGB 37, 99, 235)
          rawData[px] = 37;
          rawData[px + 1] = 99;
          rawData[px + 2] = 235;
          rawData[px + 3] = 255;
        }
      } else {
        // Transparent
        rawData[px] = 0;
        rawData[px + 1] = 0;
        rawData[px + 2] = 0;
        rawData[px + 3] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c >>> 0;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);

    return Buffer.concat([lenBuf, combined, crcBuf]);
  }

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = makeChunk('IDAT', deflated);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write 192x192
const pwa192 = createPng(192, 192);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pwa192);

// Write 512x512
const pwa512 = createPng(512, 512);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);

// Favicon (32x32)
const fav = createPng(32, 32);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), fav);

// Mask icon svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#2563eb"/>
  <path d="M256 120 C256 120 170 240 170 310 C170 360 208 400 256 400 C304 400 342 360 342 310 C342 240 256 120 256 120 Z" fill="#ffffff"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'mask-icon.svg'), svg);

console.log('Icons created successfully in /public');
