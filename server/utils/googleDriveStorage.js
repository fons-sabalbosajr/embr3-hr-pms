import { Readable } from "stream";
import { buildDriveClient } from "./googleAuth.js";

let driveClient;
function getDriveClient() {
  if (driveClient) return driveClient;
  // Use centralized builder: supports GOOGLE_SERVICE_ACCOUNT_JSON, *_BASE64, or *_KEY path
  driveClient = buildDriveClient(["https://www.googleapis.com/auth/drive"]);
  return driveClient;
}

export async function driveUpload({
  readableStream,
  buffer,
  filename,
  mimeType,
  parentFolderId,
}) {
  const drive = getDriveClient();
  const media = {
    mimeType: mimeType || "application/octet-stream",
    body: readableStream || (buffer ? BufferToStream(buffer) : null),
  };
  if (!media.body) throw new Error("No content provided for upload");
  const parents = parentFolderId
    ? [parentFolderId]
    : process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGE
    ? [process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGE]
    : process.env.GOOGLE_DRIVE_FOLDER_ID_FILE
    ? [process.env.GOOGLE_DRIVE_FOLDER_ID_FILE]
    : process.env.GOOGLE_DRIVE_FOLDER_ID
    ? [process.env.GOOGLE_DRIVE_FOLDER_ID]
    : undefined;
  try {
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents,
      },
      media,
      fields: "id,name,mimeType,size,webViewLink,webContentLink,createdTime",
      supportsAllDrives: true,
    });
    return res.data; // { id, name, ... }
  } catch (err) {
    const msg = String(err?.message || err).toLowerCase();
    if (msg.includes("service accounts do not have storage quota")) {
      const e = new Error(
        "Upload failed: Service Account has no storage quota. Use a Shared Drive folder ID (and share with the service account) or set GOOGLE_IMPERSONATE_USER with domain-wide delegation."
      );
      e.status = 500;
      throw e;
    }
    throw err;
  }
}

export async function driveGetStream(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return res.data;
}

export async function driveDelete(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

export async function driveList({ parentFolderId, pageSize = 100 } = {}) {
  try {
    const drive = getDriveClient();
    // For browsing, prefer the file/general folder; avatar folder is separate
    const folderId =
      parentFolderId ||
      process.env.GOOGLE_DRIVE_FOLDER_ID_FILE ||
      process.env.GOOGLE_DRIVE_FOLDER_ID ||
      process.env.GOOGLE_DRIVE_FOLDER_ID_IMAGE;
    const q = folderId
      ? `'${folderId}' in parents and trashed = false`
      : "trashed = false";
    const res = await drive.files.list({
      q,
      pageSize,
      fields: "files(id,name,mimeType,size,createdTime,webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return res.data.files;
  } catch (err) {
    const msg = err?.message || String(err);
    if (/invalid_grant/i.test(msg) && /jwt/i.test(msg)) {
      // Provide actionable hint for the UI
      const hint =
        "Invalid JWT signature. Use a valid Google Service Account JSON key (with client_email and private_key). Do not use OAuth client credentials or a Gmail password. Also ensure server clock is correct and the Drive folder is shared to the service account.";
      const e = new Error(`${msg}. ${hint}`);
      e.status = 500;
      throw e;
    }
    throw err;
  }
}

export async function driveRename(fileId, newName) {
  const drive = getDriveClient();
  const res = await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: "id,name",
  });
  return res.data;
}

function BufferToStream(buffer) {
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
