import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

code = code.replace(
  /dragElastic=\{0\.4\}/g,
  `dragElastic={0.4}\n                 dragSnapToOrigin={true}\n                 animate={{ x: 0 }}`
);

if (code.includes('dragSnapToOrigin={true}')) {
  console.log("Successfully patched large sliders!");
} else {
  console.log("Failed to patch large sliders");
}

fs.writeFileSync('src/components/SetupProfile.tsx', code);
