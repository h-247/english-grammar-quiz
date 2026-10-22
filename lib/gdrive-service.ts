import path from 'path';

interface DriveFileResponse {
  id: string;
  name: string;
  mimeType?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

export async function fetchDriveFolderMetadata(
  folderId: string
): Promise<{ id: string; name: string } | null> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let tokenPath: string | null = null;

  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      const userProfile =
        process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\toanv';
      tokenPath = path.resolve(
        userProfile,
        '.gemini/antigravity/plugin_data/gdrive/token.json'
      );

      if (fs.existsSync(tokenPath)) {
        const parsed = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        accessToken = parsed.token?.access_token || null;
        refreshToken = parsed.token?.refresh_token || null;
        clientId = parsed.client_id || null;
        clientSecret = parsed.client_secret || null;
      }
    }
  } catch {}

  const queryFolder = async (token: string) => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      return { status: res.status, data: null };
    }
    const data = (await res.json()) as DriveFileResponse;
    return { status: 200, data };
  };

  if (accessToken) {
    try {
      const res = await queryFolder(accessToken);
      if (res.status === 200 && res.data?.name) {
        return { id: folderId, name: res.data.name };
      }

      // Try refresh token if expired
      if (res.status === 401 && refreshToken && clientId && clientSecret) {
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

        if (refreshRes.ok) {
          const newTokens = (await refreshRes.json()) as TokenResponse;
          if (newTokens.access_token) {
            accessToken = newTokens.access_token;
            if (tokenPath) {
              try {
                const fs = await import('fs');
                const currentContent = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                currentContent.token.access_token = newTokens.access_token;
                fs.writeFileSync(tokenPath, JSON.stringify(currentContent, null, 2));
              } catch {}
            }

            const retry = await queryFolder(newTokens.access_token);
            if (retry.status === 200 && retry.data?.name) {
              return { id: folderId, name: retry.data.name };
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching drive folder metadata:', err);
    }
  }

  // Fallback for default repository folder
  if (folderId === '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd') {
    return { id: folderId, name: 'grammar' };
  }

  return null;
}
