import fs from 'fs';
let code = fs.readFileSync('src/services/fileTransferService.ts', 'utf8');
code = code.replace(
  /dc\.onopen = \(\) => \{\s*this\.sendFile\(dc, file, onProgress\)\.then\(\(\) => \{\s*resolve\('sent'\);\s*\}\)\.catch\(reject\);\s*\};\s*\}/,
  `if (dc.readyState === 'open') {
             this.sendFile(dc, file, onProgress).then(() => resolve('sent')).catch(reject);
          } else {
             dc.onopen = () => {
                this.sendFile(dc, file, onProgress).then(() => resolve('sent')).catch(reject);
             };
          }
        }`
);
fs.writeFileSync('src/services/fileTransferService.ts', code);
