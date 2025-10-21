import CryptoJS from 'crypto-js';

// Encryption secret (set in env for production)
const SECRET_KEY = import.meta.env.VITE_ENCRYPT_SECRET || 'default-secret';
// Salt to obfuscate storage keys (can reuse secret or provide a separate salt)
const KEY_SALT = import.meta.env.VITE_KEY_SALT || SECRET_KEY;

// Derive a short obfuscated key for localStorage to avoid obvious key names
const obfuscateKey = (key) => {
  try {
    const digest = CryptoJS.SHA256(`${key}:${KEY_SALT}`).toString();
    return `__app__${digest.slice(0, 20)}`; // compact prefix to keep keys small
  } catch {
    return key; // fallback to plain key if hashing fails
  }
};

// Encrypt and store
export const secureStore = (key, value) => {
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(value), SECRET_KEY).toString();
  const storageKey = obfuscateKey(key);
  // Write to obfuscated key
  localStorage.setItem(storageKey, encrypted);
  // Clean legacy plain key if present
  try { localStorage.removeItem(key); } catch {}
};

// Retrieve and decrypt (alias)
export const secureGet = (key) => {
  const storageKey = obfuscateKey(key);
  let encrypted = localStorage.getItem(storageKey);
  // Backward-compat: migrate from legacy plain key name if found
  if (!encrypted) {
    encrypted = localStorage.getItem(key);
    if (encrypted) {
      try {
        const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
        const value = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        // Re-store under obfuscated key and remove legacy
        localStorage.setItem(storageKey, encrypted);
        try { localStorage.removeItem(key); } catch {}
        return value;
      } catch {
        // If legacy is not encrypted (older versions), try to parse and migrate
        try {
          const value = JSON.parse(encrypted);
          secureStore(key, value);
          try { localStorage.removeItem(key); } catch {}
          return value;
        } catch {
          return null;
        }
      }
    }
  }
  if (!encrypted) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
};

// Optional: keep the original name for backward compatibility
export const secureRetrieve = secureGet;

// Delete item
export const secureRemove = (key) => {
  const storageKey = obfuscateKey(key);
  try { localStorage.removeItem(storageKey); } catch {}
  try { localStorage.removeItem(key); } catch {}
};
