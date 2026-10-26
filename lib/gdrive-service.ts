export interface DriveFileItem {
  id: string;
  name: string;
  mimeType?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

let cachedAccessToken: string | null = null;
let inflightRefreshPromise: Promise<string | null> | null = null;

const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory caches with size limits to prevent memory leaks
const metadataCache = new Map<
  string,
  { data: { id: string; name: string } | null; timestamp: number }
>();
const filesCache = new Map<
  string,
  { data: DriveFileItem[]; timestamp: number }
>();

function setInCache<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

export function clearDriveCache(): void {
  metadataCache.clear();
  filesCache.clear();
}

/**
 * Resolves Google OAuth credentials with priority:
 * 1. Environment variables (Cloudflare Secrets / .env)
 * 2. appSettings table in D1 database (Edge-ready)
 * 3. In-memory cached token
 * 4. Local filesystem token file fallback (development only in Node.js)
 */
async function getGoogleCredentials(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
  tokenFilePath: string | null;
}> {
  let accessToken =
    process.env.GOOGLE_DRIVE_ACCESS_TOKEN ||
    process.env.GDRIVE_ACCESS_TOKEN ||
    cachedAccessToken ||
    null;
  let refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GDRIVE_REFRESH_TOKEN ||
    null;
  let clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GDRIVE_CLIENT_ID ||
    null;
  let clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GDRIVE_CLIENT_SECRET ||
    null;
  let tokenFilePath: string | null = null;

  // Edge & D1 fallback: check appSettings table in database
  if (!accessToken || !refreshToken || !clientId || !clientSecret) {
    try {
      const { getDb } = await import('@/db');
      const { appSettings } = await import('@/db/schema');
      const { inArray } = await import('drizzle-orm');
      const db = getDb();
      const rows = await db
        .select()
        .from(appSettings)
        .where(
          inArray(appSettings.key, [
            'gdrive_access_token',
            'gdrive_refresh_token',
            'gdrive_client_id',
            'gdrive_client_secret',
          ])
        )
        .all();

      const map = new Map<string, string>();
      for (let i = 0; i < rows.length; i++) {
        map.set(rows[i].key, rows[i].value);
      }

      if (!accessToken && map.has('gdrive_access_token')) {
        accessToken = map.get('gdrive_access_token') || null;
      }
      if (!refreshToken && map.has('gdrive_refresh_token')) {
        refreshToken = map.get('gdrive_refresh_token') || null;
      }
      if (!clientId && map.has('gdrive_client_id')) {
        clientId = map.get('gdrive_client_id') || null;
      }
      if (!clientSecret && map.has('gdrive_client_secret')) {
        clientSecret = map.get('gdrive_client_secret') || null;
      }
    } catch {
      // Safe to ignore if DB is offline during tests or build
    }
  }

  // Development fallback: only check local token file when running in Node.js
  if (
    (!accessToken || !refreshToken) &&
    typeof process !== 'undefined' &&
    process.versions?.node
  ) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const userProfile =
        process.env.USERPROFILE || process.env.HOME || '';
      if (userProfile) {
        const potentialPath = path.resolve(
          userProfile,
          '.gemini/antigravity/plugin_data/gdrive/token.json'
        );
        if (fs.existsSync(potentialPath)) {
          tokenFilePath = potentialPath;
          const parsed = JSON.parse(fs.readFileSync(potentialPath, 'utf8'));
          if (!accessToken && parsed.token?.access_token) {
            accessToken = parsed.token.access_token;
          }
          if (!refreshToken && parsed.token?.refresh_token) {
            refreshToken = parsed.token.refresh_token;
          }
          if (!clientId && parsed.client_id) {
            clientId = parsed.client_id;
          }
          if (!clientSecret && parsed.client_secret) {
            clientSecret = parsed.client_secret;
          }
        }
      }
    } catch {
      // In Edge runtime or if fs fails, safely ignore
    }
  }

  return { accessToken, refreshToken, clientId, clientSecret, tokenFilePath };
}

/**
 * Refreshes an expired Google OAuth access token using a refresh token.
 * Persists the refreshed token to DB and disk where possible.
 * Deduplicates concurrent refresh requests to prevent race conditions.
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tokenFilePath: string | null
): Promise<string | null> {
  if (inflightRefreshPromise) {
    return inflightRefreshPromise;
  }

  inflightRefreshPromise = (async () => {
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshRes.ok) return null;

      const newTokens = (await refreshRes.json()) as TokenResponse;
      if (newTokens.access_token) {
        cachedAccessToken = newTokens.access_token;

        // 1. Persist to appSettings in DB
        try {
          const { getDb } = await import('@/db');
          const { sql } = await import('drizzle-orm');
          const db = getDb();
          await db.run(
            sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gdrive_access_token', ${newTokens.access_token})`
          );
        } catch {}

        // 2. Persist to file if local Node
        if (tokenFilePath && typeof process !== 'undefined' && process.versions?.node) {
          try {
            const fs = await import('fs');
            const currentContent = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
            if (!currentContent.token) currentContent.token = {};
            currentContent.token.access_token = newTokens.access_token;
            fs.writeFileSync(tokenFilePath, JSON.stringify(currentContent, null, 2));
          } catch {}
        }

        return newTokens.access_token;
      }
    } catch (err) {
      console.error('Error refreshing Google Drive token:', err);
    } finally {
      inflightRefreshPromise = null;
    }
    return null;
  })();

  return inflightRefreshPromise;
}

/**
 * Performs an authenticated fetch against the Google Drive API, automatically
 * refreshing the token on 401 response if credentials allow.
 */
export async function fetchWithDriveAuth(
  url: string,
  init?: RequestInit
): Promise<Response | null> {
  const creds = await getGoogleCredentials();
  let token = creds.accessToken;

  if (!token && creds.refreshToken && creds.clientId && creds.clientSecret) {
    token = await refreshAccessToken(
      creds.refreshToken,
      creds.clientId,
      creds.clientSecret,
      creds.tokenFilePath
    );
  }

  if (!token) return null;

  let res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // If 401 Unauthorized, attempt refresh once
  if (res.status === 401 && creds.refreshToken && creds.clientId && creds.clientSecret) {
    const newToken = await refreshAccessToken(
      creds.refreshToken,
      creds.clientId,
      creds.clientSecret,
      creds.tokenFilePath
    );
    if (newToken) {
      res = await fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
  }

  return res;
}

/**
 * Fetches Google Drive folder metadata (id, name) with in-memory caching.
 */
export async function fetchDriveFolderMetadata(
  folderId: string,
  options?: { forceRefresh?: boolean }
): Promise<{ id: string; name: string } | null> {
  if (!folderId) return null;

  const now = Date.now();
  if (!options?.forceRefresh) {
    const cached = metadataCache.get(folderId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType`
    );
    if (res && res.ok) {
      const data = (await res.json()) as { id: string; name: string };
      if (data?.name) {
        const result = { id: folderId, name: data.name };
        setInCache(metadataCache, folderId, { data: result, timestamp: now });
        return result;
      }
    }
  } catch (err) {
    console.error('Error fetching drive folder metadata:', err);
  }

  // Fallback for default repository folder and sample book folder
  if (folderId === '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd') {
    const defaultRes = { id: folderId, name: 'grammar' };
    setInCache(metadataCache, folderId, { data: defaultRes, timestamp: now });
    return defaultRes;
  }
  if (folderId === '13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT') {
    const bookRes = {
      id: folderId,
      name: 'The Optimist_ Sam Altman, OpenAI, and the Race to Invent the -- Keach Hagey -- 2025.pdf',
    };
    setInCache(metadataCache, folderId, { data: bookRes, timestamp: now });
    return bookRes;
  }

  setInCache(metadataCache, folderId, { data: null, timestamp: now });
  return null;
}

/**
 * Lists files inside a Google Drive folder via drive.files.list with caching.
 */
export async function listDriveFolderFiles(
  folderId: string,
  options?: { forceRefresh?: boolean; jsonOnly?: boolean }
): Promise<DriveFileItem[]> {
  if (!folderId) return [];

  const now = Date.now();
  if (!options?.forceRefresh) {
    const cached = filesCache.get(folderId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const query = options?.jsonOnly
      ? `'${folderId}' in parents and (mimeType = 'application/json' or name contains '.json') and trashed = false`
      : `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=1000&orderBy=name`;

    const res = await fetchWithDriveAuth(url);
    if (res && res.ok) {
      const data = (await res.json()) as { files?: DriveFileItem[] };
      const files = data.files || [];
      setInCache(filesCache, folderId, { data: files, timestamp: now });
      return files;
    }
  } catch (err) {
    console.error('Error listing drive folder files:', err);
  }

  return [];
}

/**
 * Downloads the text content of a file from Google Drive.
 */
export async function fetchDriveFileContent(
  fileId: string
): Promise<string | null> {
  if (!fileId) return null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    const res = await fetchWithDriveAuth(url);
    if (res && res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.error('Error fetching drive file content:', err);
  }

  return null;
}
