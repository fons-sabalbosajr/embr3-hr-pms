import { google } from 'googleapis';
import path from 'path';

let driveClient;

function getDriveClient() {
  if (driveClient) return driveClient;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || path.join(process.cwd(), 'server', 'config', 'service-account.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export async function driveUpload({ readableStream, buffer, filename, mimeType, parentFolderId }) {
  const drive = getDriveClient();
  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: readableStream || (buffer ? BufferToStream(buffer) : null)
  };
  if (!media.body) throw new Error('No content provided for upload');
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: parentFolderId ? [parentFolderId] : (process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined),
    },
    media,
    fields: 'id,name,mimeType,size,webViewLink,webContentLink,createdTime'
  });
  // Make sure it's at least accessible by link if desired (optional):
  // await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' }});
  return res.data; // { id, name, ... }
}

export async function driveGetStream(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return res.data;
}

export async function driveDelete(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

export async function driveList({ parentFolderId, pageSize = 100 } = {}) {
  const drive = getDriveClient();
  const folderId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const q = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';
  const res = await drive.files.list({ q, pageSize, fields: 'files(id,name,mimeType,size,createdTime,webViewLink)' });
  return res.data.files;
}

export async function driveRename(fileId, newName) {
  const drive = getDriveClient();
  const res = await drive.files.update({ fileId, requestBody: { name: newName }, fields: 'id,name' });
  return res.data;
}

function BufferToStream(buffer) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export default {
  driveUpload,
  driveGetStream,
  driveDelete,
  driveList,
  driveRename,
};
