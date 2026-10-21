import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { importQuizData } from '@/lib/importer';

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const url = new URL(request.url);

    const overwrite = url.searchParams.get('overwrite') === 'true';
    const courseId = url.searchParams.get('course_id') || undefined;

    const contentType = request.headers.get('content-type') || '';
    let rawContent: string | Record<string, any>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { detail: 'Please upload a JSON file.' },
          { status: 400 }
        );
      }
      rawContent = await file.text();
    } else if (contentType.includes('application/json')) {
      rawContent = await request.text();
    } else {
      return NextResponse.json(
        { detail: 'Please upload a JSON file or send JSON payload.' },
        { status: 400 }
      );
    }

    if (!rawContent) {
      return NextResponse.json(
        { detail: 'Empty file or payload provided.' },
        { status: 400 }
      );
    }

    const result = await importQuizData(rawContent, db, {
      overwrite,
      courseId,
    });

    const statusCode = result.is_duplicate ? 200 : 201;
    return NextResponse.json(result, { status: statusCode });
  } catch (err: any) {
    const isValidation = err.message?.includes('validation');
    return NextResponse.json(
      { detail: err.message },
      { status: isValidation ? 422 : 400 }
    );
  }
}
