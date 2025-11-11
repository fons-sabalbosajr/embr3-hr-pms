import CryptoJS from 'crypto-js';

// Derive key: require a strong secret; fallback is intentionally obvious (encourages setting env)
const RAW_SECRET = import.meta.env.VITE_ENCRYPT_SECRET || 'PLEASE_SET_VITE_ENCRYPT_SECRET';
// Strengthen using SHA256 to ensure fixed length key material
const DERIVED_KEY = CryptoJS.SHA256(RAW_SECRET).toString().slice(0, 32); // AES-256 key size
// Allow override when rotating (in-memory only)
let activeKey = DERIVED_KEY;

// Random IV per value (stored alongside ciphertext). Structure: iv:ciphertext
const generateIv = () => CryptoJS.lib.WordArray.random(16).toString();

const PREFIX = 'ss:'; // namespace prefix for our encrypted entries

// Internal: build storage payload
const encryptValue = (value) => {
  try {
    const iv = generateIv();
  const cipher = CryptoJS.AES.encrypt(JSON.stringify(value), activeKey, { iv: CryptoJS.enc.Hex.parse(iv) }).toString();
    return `${iv}:${cipher}`;
  } catch (e) {
    return null;
  }
};

const decryptValue = (payload) => {
  if (!payload || !payload.includes(':')) return null;
  const [ivHex, cipher] = payload.split(':');
  try {
  const bytes = CryptoJS.AES.decrypt(cipher, activeKey, { iv: CryptoJS.enc.Hex.parse(ivHex) });
    const utf8 = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(utf8);
  } catch (e) {
    return null;
  }
};

// Encrypt and store (idempotent: overwrites existing)
export const secureStore = (key, value) => {
  const encrypted = encryptValue(value);
  if (!encrypted) return;
  localStorage.setItem(key, PREFIX + encrypted);
};

// Retrieve and decrypt
export const secureGet = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  if (!raw.startsWith(PREFIX)) {
    // Auto-migrate plain values (attempt JSON parse); then re-encrypt
    try {
      const parsed = JSON.parse(raw);
      secureStore(key, parsed);
      return parsed;
    } catch (_) {
      // treat as primitive string
      secureStore(key, raw);
      return raw;
    }
  }
  const payload = raw.slice(PREFIX.length);
  return decryptValue(payload);
};

export const secureRetrieve = secureGet; // backward compatibility alias

export const secureRemove = (key) => {
  localStorage.removeItem(key);
};

// Bulk hardening: iterate through localStorage and encrypt any non-encrypted entries
export const secureHardenAll = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      if (!v) continue;
      if (!v.startsWith(PREFIX)) {
        // Attempt JSON parse else treat as string
        let parsed = v;
        try { parsed = JSON.parse(v); } catch (_) { /* keep as string */ }
        secureStore(k, parsed);
      }
    }
  } catch (e) {
    // non-fatal
    // eslint-disable-next-line no-console
    console.warn('secureHardenAll failed', e);
  }
};

// Optional helper to get a safe snapshot without decrypting each time (for diagnostics)
export const listSecureKeys = () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k) || '';
    keys.push({ key: k, encrypted: v.startsWith(PREFIX) });
  }
  return keys;
};

// Immediately harden on module load (one-time auto-migration)
secureHardenAll();

// -------------------- sessionStorage API (optional ephemeral encryption) --------------------
// Same approach, separate prefix to distinguish scopes when inspecting
const SESSION_PREFIX = 'ssess:';

const sessionEncrypt = (value) => encryptValue(value); // reuse IV + AES
const sessionDecrypt = (payload) => decryptValue(payload);

export const secureSessionStore = (key, value) => {
  const enc = sessionEncrypt(value);
  if (!enc) return;
  sessionStorage.setItem(key, SESSION_PREFIX + enc);
};

export const secureSessionGet = (key) => {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  if (!raw.startsWith(SESSION_PREFIX)) {
    // Auto-migrate plaintext
    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch (_) {}
    secureSessionStore(key, parsed);
    return parsed;
  }
  return sessionDecrypt(raw.slice(SESSION_PREFIX.length));
};

export const secureSessionRemove = (key) => {
  sessionStorage.removeItem(key);
};

export const secureSessionHardenAll = () => {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      const v = sessionStorage.getItem(k);
      if (!v) continue;
      if (!v.startsWith(SESSION_PREFIX)) {
        let parsed = v;
        try { parsed = JSON.parse(v); } catch (_) {}
        secureSessionStore(k, parsed);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('secureSessionHardenAll failed', e);
  }
};

export const listSecureSessionKeys = () => {
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (!k) continue;
    const v = sessionStorage.getItem(k) || '';
    keys.push({ key: k, encrypted: v.startsWith(SESSION_PREFIX) });
  }
  return keys;
};

// Auto-harden existing sessionStorage items
secureSessionHardenAll();

// -------------------- Key Rotation (advanced) --------------------
// Rotates encrypted entries by decrypting with old secret and re-encrypting with new secret.
// This is client-side only; ensure you coordinate deployment so all clients know the new secret.
export const rotateSecureStorage = (oldSecret, newSecret) => {
  const oldKey = CryptoJS.SHA256(oldSecret).toString().slice(0, 32);
  const newKey = CryptoJS.SHA256(newSecret).toString().slice(0, 32);

  const reencryptStore = (storage, prefix) => {
    const updates = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k) continue;
      const v = storage.getItem(k);
      if (!v || !v.startsWith(prefix)) continue;
      const payload = v.slice(prefix.length);
      // decrypt with oldKey
      try {
        const [ivHex, cipher] = payload.split(':');
        const bytes = CryptoJS.AES.decrypt(cipher, oldKey, { iv: CryptoJS.enc.Hex.parse(ivHex) });
        const utf8 = bytes.toString(CryptoJS.enc.Utf8);
        if (!utf8) continue; // skip if wrong key
        const data = JSON.parse(utf8);
        // re-encrypt with newKey (new IV)
        const newIv = CryptoJS.lib.WordArray.random(16).toString();
        const newCipher = CryptoJS.AES.encrypt(JSON.stringify(data), newKey, { iv: CryptoJS.enc.Hex.parse(newIv) }).toString();
        updates.push({ key: k, value: prefix + newIv + ':' + newCipher });
      } catch (_) {
        // skip on failure
      }
    }
    updates.forEach(({ key, value }) => storage.setItem(key, value));
    return updates.length;
  };

  const updatedLocal = reencryptStore(localStorage, PREFIX);
  const updatedSession = reencryptStore(sessionStorage, SESSION_PREFIX);

  // Switch active key for current runtime
  activeKey = newKey;
  return { updatedLocal, updatedSession };
};
