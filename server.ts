import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Directory for local file uploads
  const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // API raw upload route - buffers incoming raw stream and writes to disk reliably
  app.post('/api/upload-raw', async (req, res) => {
    try {
      const rawFilename = (req.query.filename as string) || 'file.bin';
      const mimeType = (req.query.mimeType as string) || (req.headers['content-type'] as string) || 'application/octet-stream';
      
      let safeFilename = 'file.bin';
      try {
        safeFilename = path.basename(decodeURIComponent(rawFilename));
      } catch {
        safeFilename = path.basename(rawFilename);
      }
      
      const ext = path.extname(safeFilename) || '';
      const baseClean = path.basename(safeFilename, ext).replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_').substring(0, 40) || 'file';
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${baseClean}${ext}`;
      const filePath = path.join(UPLOAD_DIR, uniqueName);

      const chunks: Buffer[] = [];
      let fileSize = 0;

      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          fileSize += chunk.length;
        });
        req.on('end', () => resolve());
        req.on('error', (err) => reject(err));
      });

      if (fileSize === 0) {
        return res.status(400).json({ error: 'Файл пуст или не передан' });
      }

      const fileBuffer = Buffer.concat(chunks);
      await fs.promises.writeFile(filePath, fileBuffer);

      const fileUrl = `/api/files/${encodeURIComponent(uniqueName)}`;
      return res.json({ 
        url: fileUrl, 
        status: 'ok', 
        fileName: safeFilename, 
        fileSize,
        mimeType
      });
    } catch (err: any) {
      console.error('Upload raw error:', err);
      res.status(500).json({ error: err.message || 'Ошибка сервера при загрузке файла' });
    }
  });

  // Configure payload limits for JSON/URL-encoded requests
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOAD_DIR));

  // Direct file access route with download and stream support
  app.get('/api/files/:filename', (req, res) => {
    try {
      const filename = path.basename(decodeURIComponent(req.params.filename));
      const filePath = path.join(UPLOAD_DIR, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл не найден' });
      }

      if (req.query.download === 'true') {
        const downloadName = (req.query.downloadName as string) || filename.replace(/^\d+_[a-z0-9]+_/, '') || filename;
        return res.download(filePath, downloadName);
      }

      res.sendFile(filePath);
    } catch (err: any) {
      console.error('File serve error:', err);
      res.status(500).json({ error: 'Ошибка сервера при отдаче файла' });
    }
  });

  // API upload route - safely stores base64 files locally on the server
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
      const safeFilename = filename ? path.basename(filename) : 'file.bin';
      const ext = path.extname(safeFilename) || '';
      const baseClean = path.basename(safeFilename, ext).replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_').substring(0, 40) || 'file';
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${baseClean}${ext}`;
      const filePath = path.join(UPLOAD_DIR, uniqueName);

      await fs.promises.writeFile(filePath, buffer);

      const fileUrl = `/api/files/${encodeURIComponent(uniqueName)}`;
      return res.json({ 
        url: fileUrl, 
        status: 'ok', 
        fileName: safeFilename, 
        fileSize: buffer.length,
        mimeType: mimeType || 'application/octet-stream'
      });
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
