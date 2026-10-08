import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

/** Rasterize the existing Sagamente symbol as portable, indexed PNG app icons.
 *  This build script uses only Node built-ins, with no new dependencies.
 */
const svg = readFileSync(new URL('../public/sagamente-mark.svg', import.meta.url), 'utf8')
const shapes = [...svg.matchAll(/<path fill="(#[a-f0-9]{6})" d="([^"]+)"/gi)]
  .flatMap((match) => match[2].split(/\s*Z\s*/i).filter(Boolean).map((part) => ({
    color: match[1].toUpperCase(),
    points: [...part.matchAll(/-?\d+(?:\.\d+)?/g)].map((item) => Number(item[0]))
  })))
const palette = ['#0A0A0B', '#F3EDE7', '#A65A2A']
if (shapes.length < 3 || shapes.some((shape) => shape.points.length < 6 || shape.points.length % 2)) {
  throw new Error('Símbolo Sagamente inesperado; confira public/sagamente-mark.svg')
}
function contains(x, y, coords) {
  let inside = false
  for (let i = 0, j = coords.length - 2; i < coords.length; j = i, i += 2) {
    const ax = coords[i], ay = coords[i + 1], bx = coords[j], by = coords[j + 1]
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay) / (by - ay)) + ax) inside = !inside
  }
  return inside
}
function crc32(buffer) {
  let result = 0xffffffff
  for (const octet of buffer) {
    result ^= octet
    for (let bit = 0; bit < 8; bit++) result = (result >>> 1) ^ ((result & 1) ? 0xedb88320 : 0)
  }
  return (result ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const tag = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])))
  return Buffer.concat([length, tag, data, crc])
}
function createIcon(size, maskable = false) {
  const rowSize = 1 + Math.ceil(size / 4)
  const raw = Buffer.alloc(size * rowSize)
  const scale = size * (maskable ? 0.58 : 0.75) / 124
  const left = (size - 100 * scale) / 2
  const top = (size - 124 * scale) / 2
  for (let y = 0; y < size; y++) {
    const row = y * rowSize
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5 - left) / scale
      const py = (y + 0.5 - top) / scale
      let color = 0
      for (const shape of shapes) {
        if (contains(px, py, shape.points)) color = palette.indexOf(shape.color)
      }
      raw[row + 1 + (x >>> 2)] |= color << (6 - ((x & 3) * 2))
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 2
  header[9] = 3
  const colors = Buffer.from(palette.flatMap((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))))
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
    chunk('PLTE', colors), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
mkdirSync(new URL('../public/pwa/', import.meta.url), { recursive: true })
for (const size of [180, 192, 512]) {
  writeFileSync(new URL('../public/pwa/icon-' + size + '.png', import.meta.url), createIcon(size))
}
writeFileSync(new URL('../public/pwa/maskable-512.png', import.meta.url), createIcon(512, true))
