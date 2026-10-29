// Renders the PWA / home-screen icons from the pixel gamecock in public/gamecock.svg.
// Usage: node scripts/generate-icons.mjs  (writes PNGs into public/)
//
// White background: the bird has a black pixel outline that disappears on black.
// The bird is a 20x22 pixel grid, so it is scaled by a whole number and drawn with
// crispEdges to keep the pixels sharp. "any" icons give the bird ~70% of the canvas;
// maskable icons keep it inside the 80% safe circle Android crops to.
import { readFileSync } from "node:fs";
import sharp from "sharp";

const BG = process.env.ICON_BG || "#FFFFFF";
const src = readFileSync(new URL("../public/gamecock.svg", import.meta.url), "utf8");
const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const W = 20, H = 22;

function iconSvg(size, birdFraction) {
  const scale = Math.max(1, Math.floor((size * birdFraction) / H));
  const bw = W * scale, bh = H * scale;
  const x = Math.round((size - bw) / 2), y = Math.round((size - bh) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>
</svg>`;
}

const out = [
  ["icon-192.png", 192, 0.72],
  ["icon-512.png", 512, 0.72],
  ["icon-maskable-192.png", 192, 0.56],
  ["icon-maskable-512.png", 512, 0.56],
  ["apple-touch-icon.png", 180, 0.72],
];

for (const [name, size, frac] of out) {
  await sharp(Buffer.from(iconSvg(size, frac))).png().toFile(new URL(`../public/${name}`, import.meta.url).pathname);
  console.log("wrote public/" + name);
}
