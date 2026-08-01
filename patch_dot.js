import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

// Fix the small toggle (dot)
code = code.replace(
  /className=\{`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform \$\{isHidden \? 'left-7' : 'left-1'\} \`\}/g,
  "className={`w-4 h-4 rounded-full bg-white absolute top-1 left-1 transition-transform duration-300 ease-in-out ${isHidden ? 'translate-x-6' : 'translate-x-0'}`}"
);

// I should check if the regex matches
if (code.includes('translate-x-6')) {
  console.log("Successfully patched dot!");
} else {
  console.log("Failed to patch dot");
}

fs.writeFileSync('src/components/SetupProfile.tsx', code);
