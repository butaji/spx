/**
 * Generate app icons from SVG
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SVG_PATH = './public/logo-large.svg';
const ICONS_DIR = './src-tauri/icons';

// SVG with transparent background for icons
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1DB954"/>
      <stop offset="100%" stop-color="#1ed760"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <path d="M256 70c-90 0-156 50-156 115 0 50 35 90 85 108v75c0 8 8 16 16 16h110c8 0 16-8 16-16v-75c50-18 85-58 85-108 0-65-66-115-156-115z" fill="#0a0a0a"/>
  <ellipse cx="190" cy="235" rx="42" ry="50" fill="url(#bgGrad)"/>
  <ellipse cx="322" cy="235" rx="42" ry="50" fill="url(#bgGrad)"/>
  <path d="M256 280l-22 35h44z" fill="url(#bgGrad)"/>
  <line x1="210" y1="320" x2="210" y2="360" stroke="url(#bgGrad)" stroke-width="12" stroke-linecap="round"/>
  <line x1="256" y1="320" x2="256" y2="360" stroke="url(#bgGrad)" stroke-width="12" stroke-linecap="round"/>
  <line x1="302" y1="320" x2="302" y2="360" stroke="url(#bgGrad)" stroke-width="12" stroke-linecap="round"/>
  <text x="256" y="430" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#0a0a0a" text-anchor="middle" letter-spacing="-2">PX</text>
</svg>`;

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: '256x256.png', size: 256 },
  { name: 'icon.png', size: 512 },
];

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Generate PNG icons
  for (const { name, size } of sizes) {
    const outputPath = path.join(ICONS_DIR, name);
    await sharp(Buffer.from(ICON_SVG))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${name}`);
  }

  // Generate ICO (Windows) - use 256x256 PNG as base
  const icoPath = path.join(ICONS_DIR, 'icon.ico');
  await sharp(Buffer.from(ICON_SVG))
    .resize(256, 256)
    .png()
    .toFile(icoPath);
  console.log('Generated: icon.ico');

  // Generate ICNS (macOS) - PNG files are embedded, need to create icns container
  // For simplicity, just copy the 512x512 PNG and note that icns needs special tooling
  const icnsSource = path.join(ICONS_DIR, 'icon.png');
  if (fs.existsSync(icnsSource)) {
    console.log('Note: icon.icns requires manual generation with iconutil or similar');
    console.log('  iconutil -c icns src-tauri/icons/icon.iconset');
  }

  console.log('\nIcon generation complete!');
}

generateIcons().catch(console.error);
