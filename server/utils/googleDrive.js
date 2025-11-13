import { Readable } from 'stream';
import { buildDriveClient } from './googleAuth.js';

// Initialize Google Drive client using env-based builder (supports BASE64/inline JSON or key file path)
export const getDriveClient = () => buildDriveClient(['https://www.googleapis.com/auth/drive']);

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
