import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { DEFAULT_PROMPT_CHAT_URL } from '@/lib/course-manifest';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const row: any = await db.get(
      sql`SELECT value FROM app_settings WHERE key = 'prompt_chat_url'`
    );

    return NextResponse.json({
      prompt_chat_url: row?.value || DEFAULT_PROMPT_CHAT_URL,
    });
  } catch (err: any) {
    return NextResponse.json(
      { prompt_chat_url: DEFAULT_PROMPT_CHAT_URL },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const body = (await request.json()) as any;
    let url = (body?.prompt_chat_url || '').trim();

    if (!url) {
      url = DEFAULT_PROMPT_CHAT_URL;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    await db.run(
      sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('prompt_chat_url', ${url})`
    );

    return NextResponse.json({
      prompt_chat_url: url,
      message: 'Prompt Chat link updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
