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

/**
 * Resolves Google OAuth credentials with priority:
 * 1. Environment variables (Cloudflare Secrets / .env)
 * 2. Cached in-memory token
 * 3. Local filesystem token file fallback (development only in Node.js)
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
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tokenFilePath: string | null
): Promise<string | null> {
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
  }
  return null;
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
 * Fetches Google Drive folder metadata (id, name).
 */
export async function fetchDriveFolderMetadata(
  folderId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetchWithDriveAuth(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType`
    );
    if (res && res.ok) {
      const data = (await res.json()) as { id: string; name: string };
      if (data?.name) {
        return { id: folderId, name: data.name };
      }
    }
  } catch (err) {
    console.error('Error fetching drive folder metadata:', err);
  }

  // Fallback for default repository folder
  if (folderId === '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd') {
    return { id: folderId, name: 'grammar' };
  }

  return null;
}

/**
 * Lists .json quiz files inside a Google Drive folder via drive.files.list.
 */
export async function listDriveFolderFiles(
  folderId: string
): Promise<DriveFileItem[]> {
  try {
    const query = `'${folderId}' in parents and (mimeType = 'application/json' or name contains '.json') and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=1000&orderBy=name`;

    const res = await fetchWithDriveAuth(url);
    if (res && res.ok) {
      const data = (await res.json()) as { files?: DriveFileItem[] };
      return data.files || [];
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
