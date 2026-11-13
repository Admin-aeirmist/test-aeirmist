import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceIcon = path.join(rootDir, 'public', 'icon-512.png');
const buildDir = path.join(rootDir, 'build');
const appxDir = path.join(buildDir, 'appx');

fs.mkdirSync(appxDir, { recursive: true });

if (!fs.existsSync(sourceIcon)) {
  console.error('Source icon not found:', sourceIcon);
  process.exit(1);
}

// Step 1: Extract the bright "A" emblem cleanly from public/icon-512.png with crisp alpha keying
const rawSrc = await sharp(sourceIcon)
  .resize(512, 512)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = Buffer.from(rawSrc.data);
for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  const maxC = Math.max(r, g, b);
  let alpha = 0;
  if (maxC >= 52) {
    alpha = 255;
  } else if (maxC > 24) {
    alpha = Math.round(((maxC - 24) / (52 - 24)) * 255);
  }
  pixels[i + 3] = alpha;
}

// Trim to exact bounding box of the A glyph, boost vibrancy slightly so it pops on 24px/32px taskbar
const trimmedLogo = await sharp(pixels, {
  raw: {
    width: rawSrc.info.width,
    height: rawSrc.info.height,
    channels: 4,
  },
})
  .trim({ threshold: 10 })
  .modulate({ brightness: 1.08, saturation: 1.18 })
  .resize(396, 396, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// Step 2: Instagram-sized rounded squircle tile (minimal outer margin = 8px, crisp 496x496 card)
const squircleSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111d3a" />
      <stop offset="50%" stop-color="#060a17" />
      <stop offset="100%" stop-color="#170e36" />
    </linearGradient>

    <radialGradient id="centerGlow" cx="50%" cy="50%" r="46%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.34" />
      <stop offset="50%" stop-color="#818cf8" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#060a17" stop-opacity="0" />
    </radialGradient>

    <linearGradient id="topSheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="30%" stop-color="#ffffff" stop-opacity="0.02" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.82" />
      <stop offset="50%" stop-color="#818cf8" stop-opacity="0.52" />
      <stop offset="100%" stop-color="#c084fc" stop-opacity="0.80" />
    </linearGradient>
  </defs>

  <rect x="8" y="8" width="496" height="496" rx="118" ry="118" fill="url(#bgGrad)" />
  <rect x="8" y="8" width="496" height="496" rx="118" ry="118" fill="url(#centerGlow)" />
  <rect x="8" y="8" width="496" height="496" rx="118" ry="118" fill="url(#topSheen)" />
  <rect x="11" y="11" width="490" height="490" rx="115" ry="115" fill="none" stroke="url(#rimGrad)" stroke-width="6" />
</svg>
`;

const masterIconPath = path.join(buildDir, 'icon.png');
const masterBuffer = await sharp(Buffer.from(squircleSvg))
  .composite([
    {
      input: trimmedLogo,
      gravity: 'center',
    },
  ])
  .png()
  .toBuffer();

await sharp(masterBuffer).toFile(masterIconPath);

// Step 3: Build multi-resolution PNG-encoded ICO (16, 24, 32, 48, 64, 128, 256)
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(masterBuffer)
      .resize(size, size, {
        fit: 'contain',
        kernel: sharp.kernel.lanczos3,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
  )
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

let offset = 6 + sizes.length * 16;
const dirEntries = [];

for (let i = 0; i < sizes.length; i++) {
  const size = sizes[i];
  const buf = pngBuffers[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(buf.length, 8);
  entry.writeUInt32LE(offset, 12);
  dirEntries.push(entry);
  offset += buf.length;
}

const icoBuffer = Buffer.concat([header, ...dirEntries, ...pngBuffers]);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);

// Step 4: Generate Microsoft Store AppX assets from the polished icon
await sharp(masterBuffer)
  .resize(50, 50, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(appxDir, 'StoreLogo.png'));

await sharp(masterBuffer)
  .resize(44, 44, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(appxDir, 'Square44x44Logo.png'));

await sharp(masterBuffer)
  .resize(150, 150, { fit: 'contain', background: { r: 6, g: 10, b: 23, alpha: 1 } })
  .png()
  .toFile(path.join(appxDir, 'Square150x150Logo.png'));

const wideCenter = await sharp(masterBuffer)
  .resize(124, 124, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 310,
    height: 150,
    channels: 4,
    background: { r: 6, g: 10, b: 23, alpha: 1 },
  },
})
  .composite([{ input: wideCenter, gravity: 'center' }])
  .png()
  .toFile(path.join(appxDir, 'Wide310x150Logo.png'));

console.log('✅ Bold large-glyph squircle Desktop ICO, PNG, and MS Store AppX icons generated in build/');
