import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { appSettings } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { DEFAULT_PROMPT_CHAT_URL } from '@/lib/course-manifest';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'prompt_chat_url'))
      .get();

    return NextResponse.json({
      prompt_chat_url: row?.value || DEFAULT_PROMPT_CHAT_URL,
    });
  } catch {
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
