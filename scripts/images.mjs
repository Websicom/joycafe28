import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
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
await copyFile(path.join(root, 'Media and Files', 'logo', 'joy-logo-pack', 'joy-open-graph-1200x630.png'), path.join(root, 'assets', 'brand', 'joy-open-graph-1200x630.png'));
await copyFile(path.join(root, 'Media and Files', 'logo', 'joy-logo-pack', 'joy-favicon-512.png'), path.join(root, 'assets', 'brand', 'joy-favicon-512.png'));
await copyFile(path.join(root, 'Media and Files', 'logo', 'joy-logo-pack', 'favicon.ico'), path.join(root, 'favicon.ico'));
console.log('Responsive images generated.');
