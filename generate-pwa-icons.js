/**
 * ArcOmni PWA Icon Generator
 * 
 * Generates all required icon sizes from public/main-logo.jpg
 * for PWABuilder, Google Play Store, and iOS compatibility.
 * 
 * Usage: node generate-pwa-icons.js
 * Requires: sharp (npm install --save-dev sharp)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, 'public', 'main-logo.jpg');
const OUTPUT_DIR = path.join(__dirname, 'public', 'icons');

// Standard icon sizes for PWA / Play Store
const STANDARD_ICONS = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// Apple touch icon
const APPLE_ICON = { size: 180, name: 'apple-touch-icon.png' };

// Maskable icons (with safe zone padding — 10% padding on each side)
const MASKABLE_ICONS = [
  { size: 192, name: 'maskable-icon-192x192.png' },
  { size: 512, name: 'maskable-icon-512x512.png' },
];

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🎨 Generating PWA icons from:', SOURCE);
  console.log('📁 Output directory:', OUTPUT_DIR);
  console.log('');

  // Generate standard icons
  for (const icon of STANDARD_ICONS) {
    await sharp(SOURCE)
      .resize(icon.size, icon.size, { fit: 'cover', position: 'center' })
      .png({ quality: 95, compressionLevel: 9 })
      .toFile(path.join(OUTPUT_DIR, icon.name));
    console.log(`  ✅ ${icon.name} (${icon.size}×${icon.size})`);
  }

  // Generate Apple touch icon
  await sharp(SOURCE)
    .resize(APPLE_ICON.size, APPLE_ICON.size, { fit: 'cover', position: 'center' })
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(path.join(OUTPUT_DIR, APPLE_ICON.name));
  console.log(`  ✅ ${APPLE_ICON.name} (${APPLE_ICON.size}×${APPLE_ICON.size}) [Apple]`);

  // Generate maskable icons with safe zone padding
  // Maskable icons need a 10% safe zone on each side, so the logo fills 80% of the canvas
  for (const icon of MASKABLE_ICONS) {
    const padding = Math.round(icon.size * 0.1);
    const innerSize = icon.size - (padding * 2);

    // Resize the logo to fit inside the safe zone
    const resizedLogo = await sharp(SOURCE)
      .resize(innerSize, innerSize, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer();

    // Create a canvas with the brand background color and composite the logo centered
    await sharp({
      create: {
        width: icon.size,
        height: icon.size,
        channels: 4,
        background: { r: 4, g: 6, b: 26, alpha: 1 }, // #04061a
      },
    })
      .composite([
        {
          input: resizedLogo,
          top: padding,
          left: padding,
        },
      ])
      .png({ quality: 95, compressionLevel: 9 })
      .toFile(path.join(OUTPUT_DIR, icon.name));

    console.log(`  ✅ ${icon.name} (${icon.size}×${icon.size}) [Maskable, ${padding}px padding]`);
  }

  console.log('');
  console.log('🎉 All PWA icons generated successfully!');
  console.log(`   Total: ${STANDARD_ICONS.length + 1 + MASKABLE_ICONS.length} icons`);
}

generateIcons().catch((err) => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
