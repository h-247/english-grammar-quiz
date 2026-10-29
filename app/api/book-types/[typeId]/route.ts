import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { bookTypes, courses } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { eq, sql } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ typeId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { typeId } = await context.params;
    await ensureDatabaseInitialized();
    const db = getDb();

    const body = (await request.json()) as { name?: string; category?: string };
    const rawName = (body.name || '').trim();

    if (!rawName) {
      return NextResponse.json({ detail: 'Type name cannot be empty.' }, { status: 400 });
    }

    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    const existing = await db
      .select()
      .from(bookTypes)
      .where(eq(bookTypes.id, typeId))
      .get();

    if (!existing) {
      return NextResponse.json({ detail: 'Book type not found.' }, { status: 404 });
    }

    const oldName = existing.name;

    await db
      .update(bookTypes)
      .set({
        name: formattedName,
        category: body.category || existing.category,
      })
      .where(eq(bookTypes.id, typeId));

    // Also update any courses that reference the old type name in main_type or genres
    try {
      const allCourses = await db.select().from(courses).all();
      for (const c of allCourses) {
        let changed = false;
        let newMainType = c.mainType;
        let newGenres = c.genres;

        if (c.mainType && c.mainType.toLowerCase().includes(oldName.toLowerCase())) {
          newMainType = c.mainType.replace(new RegExp(oldName, 'gi'), formattedName);
          changed = true;
        }

        if (Array.isArray(c.genres)) {
          const updatedGenres = c.genres.map((g) =>
            typeof g === 'string' && g.toLowerCase() === oldName.toLowerCase() ? formattedName : g
          );
          if (JSON.stringify(updatedGenres) !== JSON.stringify(c.genres)) {
            newGenres = updatedGenres as any;
            changed = true;
          }
        }

        if (changed) {
          await db
            .update(courses)
            .set({
              mainType: newMainType,
              genres: newGenres,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(courses.id, c.id));
        }
      }
    } catch {}

    return NextResponse.json({
      id: typeId,
      name: formattedName,
      category: body.category || existing.category,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { typeId } = await context.params;
    await ensureDatabaseInitialized();
    const db = getDb();

    const existing = await db
      .select()
      .from(bookTypes)
      .where(eq(bookTypes.id, typeId))
      .get();

    if (!existing) {
      return NextResponse.json({ success: true, message: 'Already deleted or not found.' });
    }

    await db.delete(bookTypes).where(eq(bookTypes.id, typeId));

    return NextResponse.json({ success: true, deletedId: typeId });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
