import Settings from "../models/Settings.js";

/**
 * Validate a password against the security settings stored in the database.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export const validatePassword = async (password) => {
  const errors = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Password is required."] };
  }

  // Load security settings from database
  let security;
  try {
    const settings = await Settings.getSingleton();
    security = settings?.security || {};
  } catch (_) {
    // Fallback to defaults if settings can't be loaded
    security = {};
  }

  const minLength = security.passwordMinLength ?? 8;
  const requiresNumber = security.passwordRequiresNumber ?? true;
  const requiresSymbol = security.passwordRequiresSymbol ?? true;

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters.`);
  }

  if (requiresNumber && !/\d/.test(password)) {
    errors.push("Password must contain at least one number.");
  }

  if (requiresSymbol && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push("Password must contain at least one special character.");
  }

  return { valid: errors.length === 0, errors };
};
