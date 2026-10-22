import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { appSettings } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { DEFAULT_PROMPT_CHAT_URL } from '@/lib/course-manifest';
import { inArray, sql } from 'drizzle-orm';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const rows = await db
      .select()
      .from(appSettings)
      .where(
        inArray(appSettings.key, [
          'prompt_chat_url',
          'gdrive_access_token',
          'gdrive_refresh_token',
          'gdrive_client_id',
          'gdrive_client_secret',
        ])
      )
      .all();

    const settingsMap = new Map<string, string>();
    for (const r of rows) {
      settingsMap.set(r.key, r.value);
    }

    const clientId = settingsMap.get('gdrive_client_id') || process.env.GOOGLE_CLIENT_ID || '';
    const hasRefreshToken = !!(
      settingsMap.get('gdrive_refresh_token') ||
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
      process.env.GDRIVE_REFRESH_TOKEN
    );
    const hasAccessToken = !!(
      settingsMap.get('gdrive_access_token') ||
      process.env.GOOGLE_DRIVE_ACCESS_TOKEN ||
      process.env.GDRIVE_ACCESS_TOKEN
    );

    return NextResponse.json({
      prompt_chat_url: settingsMap.get('prompt_chat_url') || DEFAULT_PROMPT_CHAT_URL,
      gdrive: {
        configured: hasRefreshToken || hasAccessToken,
        has_access_token: hasAccessToken,
        has_refresh_token: hasRefreshToken,
        client_id: clientId ? `${clientId.slice(0, 12)}...` : '',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        prompt_chat_url: DEFAULT_PROMPT_CHAT_URL,
        gdrive: { configured: false, has_access_token: false, has_refresh_token: false },
        error: err.message,
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const body = (await request.json()) as any;

    // 1. Update Prompt Chat URL if present
    if (typeof body.prompt_chat_url === 'string') {
      let url = body.prompt_chat_url.trim();
      if (!url) {
        url = DEFAULT_PROMPT_CHAT_URL;
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      await db.run(
        sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('prompt_chat_url', ${url})`
      );
    }

    // 2. Update Google Drive credentials if provided
    if (typeof body.gdrive_access_token === 'string') {
      await db.run(
        sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gdrive_access_token', ${body.gdrive_access_token.trim()})`
      );
    }

    if (typeof body.gdrive_refresh_token === 'string') {
      await db.run(
        sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gdrive_refresh_token', ${body.gdrive_refresh_token.trim()})`
      );
    }

    if (typeof body.gdrive_client_id === 'string') {
      await db.run(
        sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gdrive_client_id', ${body.gdrive_client_id.trim()})`
      );
    }

    if (typeof body.gdrive_client_secret === 'string') {
      await db.run(
        sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gdrive_client_secret', ${body.gdrive_client_secret.trim()})`
      );
    }

    // 3. Optional Clear Google Drive credentials
    if (body.clear_gdrive) {
      await db.run(
        sql`DELETE FROM app_settings WHERE key IN ('gdrive_access_token', 'gdrive_refresh_token', 'gdrive_client_id', 'gdrive_client_secret')`
      );
    }

    return NextResponse.json({
      message: 'Settings updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
