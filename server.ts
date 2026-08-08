import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure payload limits for large base64 file uploads (up to 50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API upload route
  app.post('/api/upload', async (req, res) => {
    try {
      const { filename, fileData, mimeType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: 'Файл не передан' });
      }

      const base64Content = fileData.includes('base64,') 
        ? fileData.split('base64,')[1] 
        : fileData;
      const buffer = Buffer.from(base64Content, 'base64');
      const safeFilename = filename || 'file.bin';
      const type = mimeType || 'application/octet-stream';

      // 1. Attempt upload to Tmpfiles.org
      try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type });
        formData.append('file', blob, safeFilename);

        const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
          method: 'POST',
          body: formData
        });

        if (tmpRes.ok) {
          const tmpJson = await tmpRes.json();
          if (tmpJson?.status === 'success' && tmpJson?.data?.url) {
            // Convert view URL https://tmpfiles.org/123/file to direct download URL https://tmpfiles.org/dl/123/file
            const directUrl = tmpJson.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            return res.json({ url: directUrl, status: 'ok' });
          }
        }
      } catch (e) {
        console.warn('Server upload to tmpfiles failed, trying fallback:', e);
      }

      // 2. Attempt upload to GoFile
      try {
        const serverRes = await fetch('https://api.gofile.io/servers');
        if (serverRes.ok) {
          const serverData = await serverRes.json();
          if (serverData?.status === 'ok' && serverData?.data?.servers?.[0]?.name) {
            const serverName = serverData.data.servers[0].name;
            const formData = new FormData();
            const blob = new Blob([buffer], { type });
            formData.append('file', blob, safeFilename);

            const gfRes = await fetch(`https://${serverName}.gofile.io/contents/uploadfile`, {
              method: 'POST',
              body: formData
            });

            if (gfRes.ok) {
              const gfJson = await gfRes.json();
              if (gfJson?.status === 'ok' && gfJson?.data?.downloadPage) {
                return res.json({ url: gfJson.data.downloadPage, status: 'ok' });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Server upload to GoFile failed:', e);
      }

      // 3. Fallback to base64 Data URL if file is <= 10MB
      if (buffer.length <= 10 * 1024 * 1024) {
        const dataUrl = `data:${type};base64,${base64Content}`;
        return res.json({ url: dataUrl, status: 'ok' });
      }

      return res.status(500).json({ error: 'Не удалось загрузить файл на файлообменник' });
    } catch (err: any) {
      console.error('Upload route error:', err);
      res.status(500).json({ error: err.message || 'Ошибка сервера при загрузке файла' });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
