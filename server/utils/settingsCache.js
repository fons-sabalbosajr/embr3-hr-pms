import mongoose from 'mongoose';
import dayjs from 'dayjs';

let cached = null;
let lastFetched = 0;
const TTL_MS = 5 * 1000; // 5 seconds cache to avoid hitting DB on every request

export async function getSettings() {
  const now = Date.now();
  if (cached && (now - lastFetched) < TTL_MS) return cached;
  const { default: Settings } = await import('../models/Settings.js');
  const doc = await Settings.findOne({}).lean();
  cached = doc || {};
  lastFetched = now;
  return cached;
}

export function setSettings(newSettings) {
  cached = newSettings;
  lastFetched = Date.now();
}
