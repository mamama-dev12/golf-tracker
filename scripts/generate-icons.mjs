import sharp from "sharp";

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#15803d"/>
  <circle cx="${size*0.38}" cy="${size*0.38}" r="${size*0.18}" fill="white"/>
  <rect x="${size*0.35}" y="${size*0.55}" width="${size*0.06}" height="${size*0.3}" rx="${size*0.02}" fill="white"/>
  <polygon points="${size*0.41},${size*0.58} ${size*0.65},${size*0.48} ${size*0.41},${size*0.68}" fill="white" opacity="0.85"/>
</svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icon-${size}.png`);
  console.log(`Generated icon-${size}.png`);
}
await sharp(Buffer.from(svg(180))).png().toFile("public/apple-touch-icon.png");
console.log("Generated apple-touch-icon.png");
