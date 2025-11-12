// Centralized Google Auth builder with env-based credentials support
import { google } from 'googleapis';
import path from 'path';

function decodeBase64Json(b64) {
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (err) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: ' + err.message);
  }
}

function parseInlineJson(str) {
  try {
    return JSON.parse(str);
  } catch (err) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ' + err.message);
  }
}

// Build a GoogleAuth instance from env vars or key file path.
// Supported envs:
// - GOOGLE_SERVICE_ACCOUNT_JSON: raw JSON string of the service account key
// - GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: base64-encoded JSON string
// - GOOGLE_SERVICE_ACCOUNT_KEY: path to key file (fallback)
// - GOOGLE_IMPERSONATE_EMAIL or GOOGLE_WORKSPACE_ADMIN: optional subject for domain-wide delegation
// - GOOGLE_SCOPES: comma-separated scopes (fallbacks to Drive Full + Drive File)
export function buildGoogleAuth(customScopes) {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const b64Json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const subject = process.env.GOOGLE_IMPERSONATE_EMAIL || process.env.GOOGLE_WORKSPACE_ADMIN;
  const scopes = customScopes || (process.env.GOOGLE_SCOPES ? process.env.GOOGLE_SCOPES.split(',').map(s => s.trim()).filter(Boolean) : [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
  ]);

  const options = { scopes };

  if (rawJson) {
    options.credentials = parseInlineJson(rawJson);
  } else if (b64Json) {
    options.credentials = decodeBase64Json(b64Json);
  } else if (keyPath) {
    options.keyFile = path.resolve(keyPath);
  } else {
    // Final fallback: commonly used default location inside repo (not recommended for prod)
    options.keyFile = path.join(process.cwd(), 'server', 'config', 'service-account.json');
  }

  if (subject) {
    options.clientOptions = { subject };
  }

  return new google.auth.GoogleAuth(options);
}

export function buildDriveClient(customScopes) {
  const auth = buildGoogleAuth(customScopes);
  return google.drive({ version: 'v3', auth });
}

export default {
  buildGoogleAuth,
  buildDriveClient,
};
