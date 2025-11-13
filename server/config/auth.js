// server/config/auth.js
import { google } from "googleapis";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const keyFile = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

export function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}
