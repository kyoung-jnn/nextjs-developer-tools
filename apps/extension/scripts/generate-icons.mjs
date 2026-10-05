import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}
function icon(size, color) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let alpha = 0;
      const rgb = [0, 0, 0];
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const u = (x + (sx + 0.5) / 4) / size,
            v = (y + (sy + 0.5) / 4) / size;
          if ((u - 0.5) ** 2 + (v - 0.5) ** 2 > 0.46 ** 2) continue;
          const white =
            v > 0.25 &&
            v < 0.75 &&
            ((u > 0.28 && u < 0.37) ||
              (u > 0.63 && u < 0.72) ||
              Math.abs(u - (0.32 + (v - 0.25) * 0.72)) < 0.045);
          alpha++;
          for (let c = 0; c < 3; c++) rgb[c] += white ? 255 : color[c];
        }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      for (let c = 0; c < 3; c++) pixels[offset + c] = alpha ? Math.round(rgb[c] / alpha) : 0;
      pixels[offset + 3] = Math.round((alpha * 255) / 16);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
await mkdir('public/icons', { recursive: true });
for (const [name, color] of [
  ['gray', [156, 163, 175]],
  ['black', [0, 0, 0]],
])
  for (const size of [16, 32, 48, 128])
    await writeFile(`public/icons/${name}-${size}.png`, icon(size, color));
