// server/config/auth.js
import dotenv from "dotenv";
import { buildDriveClient } from "../utils/googleAuth.js";

dotenv.config();

export function getDriveClient() {
  // Use more restrictive scope by default for uploads via this config
  return buildDriveClient(["https://www.googleapis.com/auth/drive.file"]);
}
