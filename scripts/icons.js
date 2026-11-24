// 의존성 없이 PNG 아이콘 생성 (그라디언트 라운드 사각형 + 'M↓' 마크)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

// 0..1 좌표계에서 점이 도형 안인지 (안티앨리어싱은 슈퍼샘플링으로)
const inRoundRect = (x, y, r) => {
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  return dx * dx + dy * dy <= r * r;
};
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
};
// 'M' + 아래 화살표 획
const STROKES = [
  [0.2, 0.72, 0.2, 0.3], [0.2, 0.3, 0.36, 0.5], [0.36, 0.5, 0.52, 0.3], [0.52, 0.3, 0.52, 0.72],
  [0.7, 0.3, 0.7, 0.7], [0.6, 0.6, 0.7, 0.72], [0.8, 0.6, 0.7, 0.72],
];
const inMark = (x, y) => STROKES.some((s) => segDist(x, y, ...s) < 0.058);

function png(size) {
  const ss = 4;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let a = 0, w = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const u = (x + (sx + 0.5) / ss) / size, v = (y + (sy + 0.5) / ss) / size;
          if (inRoundRect(u, v, 0.22)) {
            a++;
            if (inMark(u, v)) w++;
          }
        }
      const t = (x + y) / (2 * size);
      // #6366f1 → #a855f7 → #ec4899
      const g = t < 0.5
        ? [0x63 + (0xa8 - 0x63) * t * 2, 0x66 + (0x55 - 0x66) * t * 2, 0xf1 + (0xf7 - 0xf1) * t * 2]
        : [0xa8 + (0xec - 0xa8) * (t - 0.5) * 2, 0x55 + (0x48 - 0x55) * (t - 0.5) * 2, 0xf7 + (0x99 - 0xf7) * (t - 0.5) * 2];
      const wf = a ? w / a : 0;
      const o = 1 + x * 4;
      row[o] = g[0] + (255 - g[0]) * wf;
      row[o + 1] = g[1] + (255 - g[1]) * wf;
      row[o + 2] = g[2] + (255 - g[2]) * wf;
      row[o + 3] = (a / (ss * ss)) * 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function writeIcons(dir) {
  mkdirSync(dir, { recursive: true });
  for (const s of [16, 32, 48, 128]) writeFileSync(`${dir}/icon${s}.png`, png(s));
}
