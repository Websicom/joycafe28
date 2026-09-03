import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const input = path.join(root, 'Media and Files', 'images');
const output = path.join(root, 'assets', 'images');
const widths = [480, 768, 1024, 1440, 1920];
const images = {
  'image00003.jpeg': 'joy-cafe-melbourn-interior',
  'image00004.jpeg': 'joy-cafe-coffee-bar',
  'image00005.jpeg': 'joy-cafe-family',
  'image00006.jpeg': 'joy-cafe-espresso-machine',
  'image00009.jpeg': 'joy-cafe-exterior-sign',
  'image00010.jpeg': 'steff-and-mike-at-joy-cafe',
  'image00101.jpeg': 'wood-street-coffee-joy-cafe',
  'image00102.jpeg': 'joy-cafe-courtyard'
};

await mkdir(output, { recursive: true });
for (const [filename, slug] of Object.entries(images)) {
  const source = path.join(input, filename);
  const metadata = await sharp(source).metadata();
  for (const width of widths.filter((size) => size <= metadata.width)) {
    await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: width <= 768 ? 76 : 80 }).toFile(path.join(output, `${slug}-${width}.webp`));
  }
  await sharp(source).rotate().resize({ width: Math.min(1920, metadata.width), withoutEnlargement: true }).jpeg({ quality: 82, progressive: true }).toFile(path.join(output, `${slug}.jpg`));
}
await sharp(path.join(input, 'image00003.jpeg'))
  .rotate()
  .resize({ width: 480, height: 748, fit: 'cover', position: 'centre' })
  .webp({ quality: 40, effort: 6 })
  .toFile(path.join(output, 'joy-cafe-melbourn-interior-mobile.webp'));
await sharp(path.join(input, 'image00003.jpeg'))
  .rotate()
  .resize({ width: 480, height: 748, fit: 'cover', position: 'centre' })
  .avif({ quality: 38, effort: 7 })
  .toFile(path.join(output, 'joy-cafe-melbourn-interior-mobile.avif'));
await copyFile(path.join(root, 'Media and Files', 'logo', 'joy-logo-pack', 'joy-open-graph-1200x630.png'), path.join(root, 'assets', 'brand', 'joy-open-graph-1200x630.png'));
const faviconSource = path.join(root, 'Media and Files', 'logo', 'joy-logo-pack', 'joy-favicon-512.png');
await copyFile(faviconSource, path.join(root, 'assets', 'brand', 'joy-favicon-512.png'));

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
