import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');
code = code.replace(/alert\('Код скопирован!'\);/g, `const btn = e.currentTarget;
                      const originalHtml = btn.innerHTML;
                      btn.innerHTML = '<span class="text-xs font-medium">✓</span>';
                      setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);`);
code = code.replace(/onClick=\{\(\) => \{/g, 'onClick={(e) => {');
fs.writeFileSync('src/components/SetupProfile.tsx', code);
