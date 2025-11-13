import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

// Initialize Google Drive client using a service account JSON in config/service-account.json
// Ensure the service account has access to the target Drive folder (shared with it by email)
export const getDriveClient = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Prefer environment-configured key file paths
  const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const defaultKey = path.resolve(__dirname, '..', 'config', 'service-account.json');
  const candidate = envKey ? envKey : defaultKey;
  // Resolve relative paths relative to server/utils folder root
  const keyPath = path.isAbsolute(candidate)
    ? candidate
    : path.resolve(__dirname, '..', candidate.replace(/^\.\//, ''));

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Missing Google service account JSON at ${keyPath}. Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE or place default at server/config/service-account.json`);
  }
  const subject = process.env.GOOGLE_IMPERSONATE_USER; // optional: domain-wide delegation to act as a user
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive'],
    clientOptions: subject ? { subject } : undefined,
  });
  const drive = google.drive({ version: 'v3', auth });
  return drive;
};

export const uploadToDrive = async ({ buffer, mimeType, filename, folderId }) => {
  const drive = getDriveClient();
  // Create file metadata
  const fileMetadata = {
    name: filename,
    parents: folderId ? [folderId] : undefined,
  };
  const media = {
    mimeType: mimeType || 'application/octet-stream',
  body: Buffer.isBuffer(buffer) ? BufferToStream(buffer) : buffer,
  };
  const supportsAllDrives = true;
  const { data } = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, mimeType, webViewLink, webContentLink',
    supportsAllDrives,
  });

  // Make the file viewable by anyone with the link
  try {
    await drive.permissions.create({
      fileId: data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
  } catch (_) {
    // ignore permission errors if not allowed; link may still work if folder is shared appropriately
  }

  // Fetch webViewLink after setting permissions
  const { data: meta } = await drive.files.get({ fileId: data.id, fields: 'id, webViewLink, webContentLink', supportsAllDrives });
  return { id: meta.id, webViewLink: meta.webViewLink, webContentLink: meta.webContentLink };
};

function BufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}
