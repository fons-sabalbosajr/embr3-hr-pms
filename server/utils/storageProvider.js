import fs from 'fs';
import path from 'path';
import { driveUpload, driveGetStream, driveDelete, driveList } from './googleDriveStorage.js';

const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const LOCAL_ROOT = path.join(process.cwd(), 'uploads');

if (provider === 'local') {
  if (!fs.existsSync(LOCAL_ROOT)) fs.mkdirSync(LOCAL_ROOT, { recursive: true });
}

export async function storageUpload({ buffer, readableStream, filename, mimeType, subdir }) {
  if (provider === 'drive') {
    const data = await driveUpload({ readableStream, buffer, filename, mimeType });
    // Return normalized result
    return { provider: 'drive', id: data.id, name: data.name, mimeType: data.mimeType, size: data.size, webViewLink: data.webViewLink };
  }
  // local
  const dir = subdir ? path.join(LOCAL_ROOT, subdir) : LOCAL_ROOT;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  if (buffer) await fs.promises.writeFile(filePath, buffer);
  else if (readableStream) {
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(filePath);
      readableStream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
  } else {
    throw new Error('No content provided for upload');
  }
  return { provider: 'local', localPath: path.relative(process.cwd(), filePath), name: filename };
}

export async function storageGetStream(idOrPath) {
  if (provider === 'drive') return await driveGetStream(idOrPath);
  const full = path.isAbsolute(idOrPath) ? idOrPath : path.join(process.cwd(), idOrPath.startsWith('uploads') ? idOrPath : path.join('uploads', idOrPath));
  if (!fs.existsSync(full)) throw new Error('Not found');
  return fs.createReadStream(full);
}

export async function storageDelete(idOrPath) {
  if (provider === 'drive') return await driveDelete(idOrPath);
  const full = path.isAbsolute(idOrPath) ? idOrPath : path.join(process.cwd(), idOrPath.startsWith('uploads') ? idOrPath : path.join('uploads', idOrPath));
  if (fs.existsSync(full)) await fs.promises.unlink(full);
}

export async function storageList() {
  if (provider === 'drive') return await driveList({});
  const files = await fs.promises.readdir(LOCAL_ROOT);
  return files.map((name) => ({ name, localPath: path.join('uploads', name), size: fs.statSync(path.join(LOCAL_ROOT, name)).size }));
}

export default { storageUpload, storageGetStream, storageDelete, storageList };
