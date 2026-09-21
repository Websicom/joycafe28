import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const input = path.join(root, 'Media and Files', 'images');
const output = path.join(root, 'assets', 'images');
const documentsOutput = path.join(root, 'assets', 'documents');
const brandInput = path.join(root, 'Media and Files', 'logo');
const brandOutput = path.join(root, 'assets', 'brand');
const widths = [480, 768, 1024, 1440, 1920];
const images = {
  'Joy-cafe-hero.webp': 'joy-cafe-melbourn-interior',
  'image00004.jpeg': 'joy-cafe-coffee-bar',
  'image00005.jpeg': 'joy-cafe-family',
  'image00006.jpeg': 'joy-cafe-espresso-machine',
  'image00008.jpeg': 'joy-cafe-story-main',
  'image00009.jpeg': 'joy-cafe-exterior-sign',
  'image00010.jpeg': 'steff-and-mike-at-joy-cafe',
  'image00101.jpeg': 'wood-street-coffee-joy-cafe',
  'image00102.jpeg': 'joy-cafe-courtyard'
};

await mkdir(output, { recursive: true });
await mkdir(documentsOutput, { recursive: true });
await mkdir(brandOutput, { recursive: true });
for (const [filename, slug] of Object.entries(images)) {
  const source = path.join(input, filename);
  const metadata = await sharp(source).metadata();
  for (const width of widths.filter((size) => size <= metadata.width)) {
    await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: width <= 768 ? 76 : 80 }).toFile(path.join(output, `${slug}-${width}.webp`));
  }
  await sharp(source).rotate().resize({ width: Math.min(1920, metadata.width), withoutEnlargement: true }).jpeg({ quality: 82, progressive: true }).toFile(path.join(output, `${slug}.jpg`));
}
await sharp(path.join(input, 'Joy-cafe-hero.webp'))
  .rotate()
  .resize({ width: 480, height: 748, fit: 'cover', position: 'centre' })
  .webp({ quality: 40, effort: 6 })
  .toFile(path.join(output, 'joy-cafe-melbourn-interior-mobile.webp'));
await sharp(path.join(input, 'Joy-cafe-hero.webp'))
  .rotate()
  .resize({ width: 480, height: 748, fit: 'cover', position: 'centre' })
  .avif({ quality: 38, effort: 7 })
  .toFile(path.join(output, 'joy-cafe-melbourn-interior-mobile.avif'));
await sharp(path.join(brandInput, 'opengraph.png')).resize(1200, 630, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(path.join(brandOutput, 'joy-open-graph-1200x630.png'));
await sharp(path.join(brandInput, 'opengraph.webp')).resize(1200, 630, { fit: 'fill' }).webp({ quality: 90 }).toFile(path.join(brandOutput, 'joy-open-graph-1200x630.webp'));
await copyFile(path.join(brandInput, 'Joy Cafe Main Logo.svg'), path.join(brandOutput, 'joy-main-logo.svg'));
await copyFile(path.join(root, 'Media and Files', 'images', 'marble bg.webp'), path.join(output, 'marble-bg.webp'));
await copyFile(path.join(root, 'Media and Files', 'Joy Wine List.pdf'), path.join(documentsOutput, 'joy-wine-list.pdf'));
const faviconSource = path.join(brandInput, 'joy-favicon.png');
await sharp(faviconSource).resize(720, 720, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(path.join(brandOutput, 'joy-favicon.png'));
await sharp(path.join(brandInput, 'joy-favicon.webp')).resize(720, 720, { fit: 'fill' }).webp({ quality: 90 }).toFile(path.join(brandOutput, 'joy-favicon.webp'));
await Promise.all([
  [512, 'joy-favicon-512.png'],
  [192, 'joy-favicon-192.png'],
  [180, 'apple-touch-icon.png'],
  [152, 'apple-touch-icon-152x152.png'],
  [120, 'apple-touch-icon-120x120.png']
].map(([size, filename]) => sharp(faviconSource)
  .resize(size, size, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toFile(path.join(brandOutput, filename))));

const faviconSizes = [16, 32, 48];
const faviconImages = await Promise.all(faviconSizes.map((size) => sharp(faviconSource)
  .resize(size, size, { fit: 'contain' })
  .png({ palette: true, compressionLevel: 9 })
  .toBuffer()));
const faviconHeader = Buffer.alloc(6 + (faviconImages.length * 16));
faviconHeader.writeUInt16LE(0, 0);
faviconHeader.writeUInt16LE(1, 2);
faviconHeader.writeUInt16LE(faviconImages.length, 4);
let faviconOffset = faviconHeader.length;
faviconImages.forEach((image, index) => {
  const size = faviconSizes[index];
  const entry = 6 + (index * 16);
  faviconHeader.writeUInt8(size, entry);
  faviconHeader.writeUInt8(size, entry + 1);
  faviconHeader.writeUInt16LE(1, entry + 4);
  faviconHeader.writeUInt16LE(32, entry + 6);
  faviconHeader.writeUInt32LE(image.length, entry + 8);
  faviconHeader.writeUInt32LE(faviconOffset, entry + 12);
  faviconOffset += image.length;
});
await writeFile(path.join(root, 'favicon.ico'), Buffer.concat([faviconHeader, ...faviconImages]));
console.log('Responsive images generated.');
