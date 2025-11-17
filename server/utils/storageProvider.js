import fs from 'fs';
import path from 'path';
import { driveUpload, driveGetStream, driveDelete, driveList } from './googleDriveStorage.js';

const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const LOCAL_ROOT = path.resolve(path.join(process.cwd(), 'uploads'));

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
  const dir = subdir ? safeJoin(LOCAL_ROOT, subdir) : LOCAL_ROOT;
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
  const base = LOCAL_ROOT;
  const rel = idOrPath.startsWith('uploads') ? idOrPath.replace(/^uploads[\/\\]?/, '') : idOrPath;
  const full = safeJoin(base, rel);
  if (!fs.existsSync(full)) throw new Error('Not found');
  return fs.createReadStream(full);
}

export async function storageDelete(idOrPath) {
  if (provider === 'drive') return await driveDelete(idOrPath);
  const base = LOCAL_ROOT;
  const rel = idOrPath.startsWith('uploads') ? idOrPath.replace(/^uploads[\/\\]?/, '') : idOrPath;
  const full = safeJoin(base, rel);
  if (fs.existsSync(full)) await fs.promises.unlink(full);
}

export async function storageList({ subdir, parentFolderId } = {}) {
  if (provider === 'drive') {
    return await driveList({ parentFolderId });
  }
  const dir = subdir ? safeJoin(LOCAL_ROOT, subdir) : LOCAL_ROOT;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  return entries.map((ent) => {
    const entryPath = path.join(dir, ent.name);
    const stat = fs.statSync(entryPath);
    const relFromUploads = path.relative(LOCAL_ROOT, entryPath).replace(/\\/g, '/');
    const isDirectory = ent.isDirectory();
    const ext = path.extname(ent.name).slice(1).toLowerCase();
    const mimeType = isDirectory ? 'folder' : (ext || 'file');
    const createdTime = (stat.birthtime || stat.mtime).toISOString();
    return {
      name: ent.name,
      localPath: `uploads/${relFromUploads}`,
      size: isDirectory ? 0 : stat.size,
      isDirectory,
      mimeType,
      createdTime,
    };
  });
}

function safeJoin(base, target) {
  const targetPath = path.resolve(base, target || '');
  const basePath = path.resolve(base);
  if (targetPath === basePath) return targetPath;
  if (!targetPath.startsWith(basePath + path.sep)) {
    throw new Error('Invalid path');
  }
  return targetPath;
}

export default { storageUpload, storageGetStream, storageDelete, storageList };
