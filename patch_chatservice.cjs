const fs = require('fs');
let code = fs.readFileSync('src/services/chatService.ts', 'utf8');

const gofileUpload = `  uploadFile: async (path: string, file: Blob | File, onProgress?: (progress: number) => void) => {
    try {
      const serverRes = await fetch('https://api.gofile.io/servers');
      const serverData = await serverRes.json();
      const server = serverData.data.servers[0].name;

      const formData = new FormData();
      formData.append('file', file, (file as File).name || 'voice.webm');

      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', \`https://\${server}.gofile.io/contents/uploadfile\`, true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.status === 'ok') {
                resolve(res.data.downloadPage);
              } else {
                reject(new Error('GoFile error: ' + res.status));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error('Upload failed with status ' + xhr.status));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },`;

const catboxUpload = `  uploadFile: async (path: string, file: Blob | File, onProgress?: (progress: number) => void) => {
    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('fileToUpload', file, (file as File).name || 'voice.webm');

      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://catbox.moe/user/api.php', true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText.trim());
          } else {
            reject(new Error('Catbox upload failed with status ' + xhr.status));
          }
        };

        xhr.onerror = () => {
          // Fallback to GoFile on CORS/Network error
          console.warn('Catbox failed, falling back to GoFile');
          const fallback = async () => {
             const serverRes = await fetch('https://api.gofile.io/servers');
             const serverData = await serverRes.json();
             const server = serverData.data.servers[0].name;
             const gfData = new FormData();
             gfData.append('file', file, (file as File).name || 'voice.webm');
             
             const xhrGf = new XMLHttpRequest();
             xhrGf.open('POST', \`https://\${server}.gofile.io/contents/uploadfile\`, true);
             xhrGf.onload = () => {
                if (xhrGf.status >= 200 && xhrGf.status < 300) {
                  try {
                    const res = JSON.parse(xhrGf.responseText);
                    if (res.status === 'ok') resolve(res.data.downloadPage);
                    else reject(new Error('GoFile error'));
                  } catch (e) { reject(e); }
                } else reject(new Error('GoFile error'));
             };
             xhrGf.onerror = () => reject(new Error('Network error during fallback upload'));
             xhrGf.send(gfData);
          };
          fallback().catch(reject);
        };
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },`;

code = code.replace(gofileUpload, catboxUpload);
fs.writeFileSync('src/services/chatService.ts', code);
