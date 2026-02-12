// Utilities for resolving server-hosted assets (e.g. uploaded avatars)
// to the current API host configured via Vite env.

import { secureGet } from "../../utils/secureStorage";

const stripTrailingSlash = (s) => String(s || "").replace(/\/+$/, "");

const getServerBaseFromSettings = () => {
  try {
    const appSettings = secureGet("appSettings");
    const v = appSettings?.serverPublicUrl;
    return v ? stripTrailingSlash(String(v)) : "";
  } catch {
    return "";
  }
};

const getExplicitServerBase = () => {
  const explicit = (
    import.meta.env.VITE_SERVER_PUBLIC_URL ||
    import.meta.env.VITE_SERVER_URL ||
    ""
  )
    .toString()
    .trim();
  return explicit ? stripTrailingSlash(explicit) : "";
};

export const getServerBaseUrl = () => {
  // Highest priority: explicitly provided server URL
  const explicit = getExplicitServerBase();
  if (explicit) return explicit;

  const apiBaseRaw = (import.meta.env.VITE_API_URL || "").toString().trim();
  if (!apiBaseRaw) return "";

  // Dev proxy mode: base is usually '/api'
  if (apiBaseRaw.startsWith("/")) {
    // When front-end uses a dev/proxy base like '/api', assets should come from the backend host,
    // not the front-end origin (which is typically :517x).
    const fromSettings = getServerBaseFromSettings();
    if (fromSettings) return fromSettings;

    if (typeof window !== "undefined" && window.location?.origin) {
      return stripTrailingSlash(window.location.origin);
    }
    return "";
  }

  try {
    const apiUrl = new URL(apiBaseRaw);
    const pathname = stripTrailingSlash(apiUrl.pathname || "");
    // If baseURL ends with '/api', assets are typically hosted on the same origin without '/api'.
    const withoutApi = pathname.endsWith("/api")
      ? pathname.slice(0, -4) || "/"
      : (pathname || "/");
    const basePath = stripTrailingSlash(withoutApi);
    return `${apiUrl.origin}${basePath && basePath !== "/" ? basePath : ""}`;
  } catch {
    return stripTrailingSlash(apiBaseRaw.replace(/\/api\/?$/, ""));
  }
};

export const resolveServerAssetUrl = (inputUrl) => {
  if (!inputUrl) return undefined;
  const raw = String(inputUrl).trim();
  if (!raw) return undefined;

  // Don't touch data/blob URLs
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;

  const serverBase = getServerBaseUrl();

  // If it's already a relative URL, resolve it against server base (or current origin)
  const fallbackBase =
    serverBase ||
    (typeof window !== "undefined" && window.location?.origin
      ? stripTrailingSlash(window.location.origin)
      : "");

  // Normalize common backend asset paths
  const normalizePath = (pathname) => {
    if (!pathname) return pathname;
    // If backend returns '/api/uploads/...', strip '/api' for direct static hosting.
    if (pathname.startsWith("/api/uploads/")) return pathname.replace(/^\/api/, "");
    return pathname;
  };

  // Absolute URL case
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const path = normalizePath(u.pathname);
      // Only rewrite if it looks like a server-hosted upload
      const looksLikeUpload = path.startsWith("/uploads/") || path.includes("/uploads/");
      if (looksLikeUpload && fallbackBase) {
        return `${fallbackBase}${path}${u.search || ""}${u.hash || ""}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  // Relative-ish cases
  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
    if (!fallbackBase) return raw.startsWith("/") ? raw : `/${raw}`;
    const p = raw.startsWith("/") ? raw : `/${raw}`;
    return `${fallbackBase}${p}`;
  }
  if (raw.startsWith("/api/uploads/")) {
    if (!fallbackBase) return raw.replace(/^\/api/, "");
    return `${fallbackBase}${raw.replace(/^\/api/, "")}`;
  }

  // Otherwise, leave as-is (could be external URL)
  return raw;
};
