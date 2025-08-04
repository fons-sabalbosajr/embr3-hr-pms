import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_ENCRYPT_SECRET || 'default-secret';

// Encrypt and store
export const secureStore = (key, value) => {
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(value), SECRET_KEY).toString();
  localStorage.setItem(key, encrypted);
};

// Retrieve and decrypt (alias)
export const secureGet = (key) => {
  const encrypted = localStorage.getItem(key);
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
  localStorage.removeItem(key);
};
