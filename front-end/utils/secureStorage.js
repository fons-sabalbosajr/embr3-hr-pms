import CryptoJS from 'crypto-js';
// Unified secure storage implementation
const RAW_SECRET = import.meta.env.VITE_ENCRYPT_SECRET || 'PLEASE_SET_VITE_ENCRYPT_SECRET';
const DERIVED_KEY = CryptoJS.SHA256(RAW_SECRET).toString().slice(0, 32);
let activeKey = DERIVED_KEY;
const KEY_SALT = import.meta.env.VITE_KEY_SALT || RAW_SECRET;
const PREFIX = 'ss:';

// ---- Key obfuscation ----
// Hash the human-readable key so the actual storage key is opaque
const obfuscateKey = (key) => {
  try {
    const digest = CryptoJS.SHA256(`${key}:${KEY_SALT}`).toString();
    return `__s__${digest.slice(0, 24)}`;
  } catch { return key; }
};

// Keep a reverse map so listSecureKeys() can report original names during diagnostics
const _keyMap = new Map(); // obfuscated → original

const _trackKey = (original) => {
  const obf = obfuscateKey(original);
  _keyMap.set(obf, original);
  return obf;
};

const generateIv = () => CryptoJS.lib.WordArray.random(16).toString();
const encryptValue = (value) => {
  try {
    const iv = generateIv();
    const cipher = CryptoJS.AES.encrypt(JSON.stringify(value), activeKey, { iv: CryptoJS.enc.Hex.parse(iv) }).toString();
    return `${iv}:${cipher}`;
  } catch (_) { return null; }
};

const decryptValue = (payload) => {
  if (!payload || !payload.includes(':')) return null;
  const [ivHex, cipher] = payload.split(':');
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, activeKey, { iv: CryptoJS.enc.Hex.parse(ivHex) });
    const utf8 = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(utf8);
  } catch (_) { return null; }
};

export const secureStore = (key, value) => {
  const encrypted = encryptValue(value);
  if (!encrypted) return;
  const storageKey = _trackKey(key);
  localStorage.setItem(storageKey, PREFIX + encrypted);
  // Clean up any old plaintext entry under the raw key
  try { if (localStorage.getItem(key) !== null) localStorage.removeItem(key); } catch {}
};

export const secureGet = (key) => {
  const storageKey = _trackKey(key);
  let raw = localStorage.getItem(storageKey);

  // Fallback: look for legacy entry stored under the raw (unhashed) key
  if (!raw) {
    raw = localStorage.getItem(key);
    if (raw) {
      // Auto-migrate: decrypt if already prefixed, otherwise treat as plaintext
      let migrated = null;
      if (raw.startsWith(PREFIX)) {
        migrated = decryptValue(raw.slice(PREFIX.length));
      }
      if (migrated === null) {
        try { migrated = JSON.parse(raw); } catch (_) { migrated = raw; }
      }
      if (migrated !== null) {
        secureStore(key, migrated); // stores under obfuscated key
        try { localStorage.removeItem(key); } catch {}
        return migrated;
      }
    }
  }

  // Fallback: look for legacy __app__ obfuscated key (old format)
  if (!raw) {
    const legacyKey = `__app__${CryptoJS.SHA256(`${key}:${KEY_SALT}`).toString().slice(0, 20)}`;
    raw = localStorage.getItem(legacyKey);
    if (raw) {
      let migrated = null;
      try {
        const bytes = CryptoJS.AES.decrypt(raw, activeKey);
        const utf8 = bytes.toString(CryptoJS.enc.Utf8);
        if (utf8) migrated = JSON.parse(utf8);
      } catch (_) {}
      if (migrated === null) { try { migrated = JSON.parse(raw); } catch (_) { migrated = raw; } }
      if (migrated !== null) { secureStore(key, migrated); try { localStorage.removeItem(legacyKey); } catch {}; return migrated; }
    }
  }

  if (!raw) return null;
  if (!raw.startsWith(PREFIX)) {
    // Plaintext found under obfuscated key — encrypt in place
    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch (_) {}
    secureStore(key, parsed);
    return parsed;
  }
  const payload = raw.slice(PREFIX.length);
  return decryptValue(payload);
};

export const secureRetrieve = secureGet; // backward compatibility alias

export const secureRemove = (key) => {
  const storageKey = _trackKey(key);
  // Remove obfuscated key (current format)
  try { localStorage.removeItem(storageKey); } catch {}
  // Remove raw key (legacy plaintext)
  try { localStorage.removeItem(key); } catch {}
  // Remove old __app__ format
  try {
    const legacyKey = `__app__${CryptoJS.SHA256(`${key}:${KEY_SALT}`).toString().slice(0, 20)}`;
    localStorage.removeItem(legacyKey);
  } catch {}
};

// Bulk hardening: iterate through localStorage and encrypt + obfuscate any non-encrypted entries
export const secureHardenAll = () => {
  try {
    // Collect keys first to avoid mutation during iteration
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) allKeys.push(k);
    }
    for (const k of allKeys) {
      const v = localStorage.getItem(k);
      if (!v) continue;
      // Skip keys that are already in our obfuscated format and encrypted
      if (k.startsWith('__s__') && v.startsWith(PREFIX)) continue;
      // If value is plaintext (not prefixed), encrypt and migrate to obfuscated key
      if (!v.startsWith(PREFIX)) {
        let parsed = v;
        try { parsed = JSON.parse(v); } catch (_) { /* keep as string */ }
        // Determine the logical key name
        const logicalKey = _keyMap.get(k) || k;
        const encrypted = encryptValue(parsed);
        if (encrypted) {
          const obfKey = _trackKey(logicalKey);
          localStorage.setItem(obfKey, PREFIX + encrypted);
          // Remove old entry if stored under a different key
          if (obfKey !== k) {
            try { localStorage.removeItem(k); } catch {}
          }
        }
      } else if (!k.startsWith('__s__')) {
        // Value is encrypted but key is not obfuscated — migrate the key
        const logicalKey = _keyMap.get(k) || k;
        const obfKey = _trackKey(logicalKey);
        if (obfKey !== k) {
          localStorage.setItem(obfKey, v);
          try { localStorage.removeItem(k); } catch {}
        }
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
    let rawValue = v;
    if (v.startsWith(PREFIX)) {
      try { rawValue = decryptValue(v.slice(PREFIX.length)); } catch (_) { rawValue = '(decrypt failed)'; }
    }
    keys.push({
      storageKey: k,
      logicalKey: _keyMap.get(k) || '(unknown)',
      encrypted: v.startsWith(PREFIX),
      obfuscated: k.startsWith('__s__'),
      rawValue,
    });
  }
  return keys;
};

// Immediately harden on module load (one-time auto-migration)
secureHardenAll();

// -------------------- sessionStorage API (encrypted + obfuscated keys) --------------------
const SESSION_PREFIX = 'ssess:';

const _sessionKeyMap = new Map();
const _trackSessionKey = (original) => {
  const obf = obfuscateKey(original);
  _sessionKeyMap.set(obf, original);
  return obf;
};

export const secureSessionStore = (key, value) => {
  const enc = encryptValue(value);
  if (!enc) return;
  const storageKey = _trackSessionKey(key);
  sessionStorage.setItem(storageKey, SESSION_PREFIX + enc);
  // Clean up any legacy plaintext entry under the raw key
  try { if (sessionStorage.getItem(key) !== null) sessionStorage.removeItem(key); } catch {}
};

export const secureSessionGet = (key) => {
  const storageKey = _trackSessionKey(key);
  let raw = sessionStorage.getItem(storageKey);

  // Fallback: look for legacy entry stored under the raw (unhashed) key
  if (!raw) {
    raw = sessionStorage.getItem(key);
    if (raw) {
      // Auto-migrate
      let migrated = null;
      if (raw.startsWith(SESSION_PREFIX)) {
        migrated = decryptValue(raw.slice(SESSION_PREFIX.length));
      }
      if (migrated === null) {
        try { migrated = JSON.parse(raw); } catch (_) { migrated = raw; }
      }
      if (migrated !== null) {
        secureSessionStore(key, migrated);
        try { sessionStorage.removeItem(key); } catch {}
        return migrated;
      }
    }
  }

  if (!raw) return null;
  if (!raw.startsWith(SESSION_PREFIX)) {
    // Plaintext under obfuscated key — encrypt in place
    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch (_) {}
    secureSessionStore(key, parsed);
    return parsed;
  }
  return decryptValue(raw.slice(SESSION_PREFIX.length));
};

export const secureSessionRemove = (key) => {
  const storageKey = _trackSessionKey(key);
  try { sessionStorage.removeItem(storageKey); } catch {}
  // Also remove raw-key legacy entries
  try { sessionStorage.removeItem(key); } catch {}
};

export const secureSessionHardenAll = () => {
  try {
    const allKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) allKeys.push(k);
    }
    for (const k of allKeys) {
      const v = sessionStorage.getItem(k);
      if (!v) continue;
      if (k.startsWith('__s__') && v.startsWith(SESSION_PREFIX)) continue;
      if (!v.startsWith(SESSION_PREFIX)) {
        let parsed = v;
        try { parsed = JSON.parse(v); } catch (_) {}
        const logicalKey = _sessionKeyMap.get(k) || k;
        const enc = encryptValue(parsed);
        if (enc) {
          const obfKey = _trackSessionKey(logicalKey);
          sessionStorage.setItem(obfKey, SESSION_PREFIX + enc);
          if (obfKey !== k) {
            try { sessionStorage.removeItem(k); } catch {}
          }
        }
      } else if (!k.startsWith('__s__')) {
        const logicalKey = _sessionKeyMap.get(k) || k;
        const obfKey = _trackSessionKey(logicalKey);
        if (obfKey !== k) {
          sessionStorage.setItem(obfKey, v);
          try { sessionStorage.removeItem(k); } catch {}
        }
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
    let rawValue = v;
    if (v.startsWith(SESSION_PREFIX)) {
      try { rawValue = decryptValue(v.slice(SESSION_PREFIX.length)); } catch (_) { rawValue = '(decrypt failed)'; }
    }
    keys.push({
      storageKey: k,
      logicalKey: _sessionKeyMap.get(k) || '(unknown)',
      encrypted: v.startsWith(SESSION_PREFIX),
      obfuscated: k.startsWith('__s__'),
      rawValue,
    });
  }
  return keys;
};

// Auto-harden existing sessionStorage items
secureSessionHardenAll();

// -------------------- Runtime Watcher --------------------
// Periodically scan both storages and encrypt any plaintext entries that may have
// been written directly (e.g., by third-party libs or legacy code paths).
const HARDEN_INTERVAL_MS = 5000; // 5 seconds
let _hardenTimer = null;

const _runRuntimeHarden = () => {
  try { secureHardenAll(); } catch (_) {}
  try { secureSessionHardenAll(); } catch (_) {}
};

// Start periodic hardening
if (typeof window !== 'undefined') {
  _hardenTimer = setInterval(_runRuntimeHarden, HARDEN_INTERVAL_MS);

  // Also listen for the `storage` event (fires when another tab writes to localStorage)
  try {
    window.addEventListener('storage', (e) => {
      if (!e.key) return; // clear event
      const val = e.newValue;
      if (val && !val.startsWith(PREFIX) && !val.startsWith(SESSION_PREFIX)) {
        // A plaintext value was written — harden immediately
        _runRuntimeHarden();
      }
    });
  } catch (_) {}
}

// Allow callers to stop the watcher if needed (e.g., in tests)
export const stopRuntimeHardening = () => {
  if (_hardenTimer) { clearInterval(_hardenTimer); _hardenTimer = null; }
};

// -------------------- Clear All Secure Storage --------------------
// Removes ALL encrypted / obfuscated keys from both localStorage and sessionStorage.
// Call this on logout to ensure no residual secrets remain in the browser.
export const secureClearAll = () => {
  // --- localStorage ---
  try {
    const localKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) localKeys.push(k);
    }
    for (const k of localKeys) {
      // Remove obfuscated keys (__s__ prefix) and any value with the encrypted prefix (ss:)
      if (k.startsWith('__s__') || k.startsWith('__app__')) {
        localStorage.removeItem(k);
      } else {
        const v = localStorage.getItem(k);
        if (v && v.startsWith(PREFIX)) localStorage.removeItem(k);
      }
    }
  } catch (_) {}

  // --- sessionStorage ---
  try {
    const sessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) sessionKeys.push(k);
    }
    for (const k of sessionKeys) {
      if (k.startsWith('__s__') || k.startsWith('__app__')) {
        sessionStorage.removeItem(k);
      } else {
        const v = sessionStorage.getItem(k);
        if (v && v.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k);
      }
    }
  } catch (_) {}

  // Clear internal tracking maps
  _keyMap.clear();
  _sessionKeyMap.clear();
};

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
