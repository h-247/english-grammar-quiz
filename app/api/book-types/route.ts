import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { bookTypes, courses } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { asc, eq, sql } from 'drizzle-orm';
import { BookTypeItem } from '@/types/quiz';

export const DEFAULT_REPO_TYPES: Array<{ id: string; name: string; category: string }> = [
  { id: 'biography', name: 'Biography', category: 'genre' },
  { id: 'grammar', name: 'Grammar', category: 'genre' },
  { id: 'science-fiction', name: 'Science Fiction', category: 'genre' },
  { id: 'reference', name: 'Reference', category: 'genre' },
  { id: 'business', name: 'Business', category: 'genre' },
  { id: 'technology', name: 'Technology', category: 'genre' },
  { id: 'history', name: 'History', category: 'genre' },
  { id: 'literature', name: 'Literature', category: 'genre' },
  { id: 'mystery', name: 'Mystery', category: 'genre' },
  { id: 'self-help', name: 'Self-Help', category: 'genre' },
  { id: 'philosophy', name: 'Philosophy', category: 'genre' },
  { id: 'psychology', name: 'Psychology', category: 'genre' },
];

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    // Clean up any remaining nonfiction or fiction
    try {
      await db.run(sql`DELETE FROM book_types WHERE lower(name) IN ('nonfiction', 'fiction', 'non-fiction')`);
    } catch {}

    let items = await db.select().from(bookTypes).orderBy(asc(bookTypes.name)).all();
    items = items.filter(
      (t) =>
        t.name.toLowerCase() !== 'nonfiction' &&
        t.name.toLowerCase() !== 'fiction' &&
        t.name.toLowerCase() !== 'non-fiction'
    );

    // If empty for any reason, seed defaults
    if (!items || items.length === 0) {
      const nowIso = new Date().toISOString();
      for (const t of DEFAULT_REPO_TYPES) {
        try {
          await db.insert(bookTypes).values({
            id: t.id,
            name: t.name,
            category: t.category,
            createdAt: nowIso,
          });
        } catch {}
      }
      items = await db.select().from(bookTypes).orderBy(asc(bookTypes.name)).all();
      items = items.filter(
        (t) =>
          t.name.toLowerCase() !== 'nonfiction' &&
          t.name.toLowerCase() !== 'fiction' &&
          t.name.toLowerCase() !== 'non-fiction'
      );
    }

    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));

    const response: BookTypeItem[] = sorted.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      created_at: t.createdAt,
    }));

    return NextResponse.json(response);
  } catch (err: any) {
    // Graceful fallback to default repo types
    return NextResponse.json(
      DEFAULT_REPO_TYPES.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        created_at: new Date().toISOString(),
      }))
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const body = (await request.json()) as { name?: string; category?: string };
    const rawName = (body.name || '').trim();

    if (!rawName) {
      return NextResponse.json({ detail: 'Type name cannot be empty.' }, { status: 400 });
    }

    // Standardize casing (Title Case)
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const category = body.category === 'broad' ? 'broad' : 'genre';

    // Check if type with same name already exists (case-insensitive)
    const existing = await db
      .select()
      .from(bookTypes)
      .where(sql`lower(${bookTypes.name}) = ${formattedName.toLowerCase()}`)
      .get();

    if (existing) {
      return NextResponse.json(
        {
          id: existing.id,
          name: existing.name,
          category: existing.category,
          created_at: existing.createdAt,
        },
        { status: 200 }
      );
    }

    const id = formattedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(bookTypes).values({
      id,
      name: formattedName,
      category,
      createdAt: nowIso,
    });

    return NextResponse.json(
      {
        id,
        name: formattedName,
        category,
        created_at: nowIso,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
