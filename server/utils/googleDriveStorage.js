import { google } from "googleapis";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

let driveClient;

function getDriveClient() {
  if (driveClient) return driveClient;
  // Prefer *_FILE overrides when provided (separate purpose creds)
  const keyPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ||
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    path.join(process.cwd(), "server", "config", "service-account.json");
  // Basic diagnostics to help spot common misconfigurations
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Google Drive key file not found at ${keyPath}. Set GOOGLE_SERVICE_ACCOUNT_KEY to an absolute path or place the JSON at server/config/service-account.json`
    );
  }
  try {
    const raw = fs.readFileSync(keyPath, "utf8");
    const json = JSON.parse(raw);
    if (!json.private_key || !json.client_email) {
      throw new Error(
        "Invalid key file: missing private_key or client_email. Make sure you downloaded a Service Account JSON key, not an OAuth client credential."
      );
    }
    // Quick format sanity: private_key should include BEGIN PRIVATE KEY
    if (!/BEGIN PRIVATE KEY/.test(json.private_key)) {
      throw new Error(
        "Invalid private_key format. Ensure you are using the unmodified Service Account private key JSON."
      );
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Failed to parse Google key JSON: ${e.message}`);
    }
    // Re-throw other errors (e.g., from validation above)
    throw e;
  }
  const subject = process.env.GOOGLE_IMPERSONATE_USER; // optional domain-wide delegation
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/drive"],
    clientOptions: subject ? { subject } : undefined,
  });
  driveClient = google.drive({ version: "v3", auth });
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
    // Prefer *_FILE overrides for folder as well
    const folderId =
      parentFolderId ||
      process.env.GOOGLE_DRIVE_FOLDER_ID_FILE ||
      process.env.GOOGLE_DRIVE_FOLDER_ID;
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
