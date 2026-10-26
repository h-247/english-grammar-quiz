import { NextResponse } from 'next/server';
import { fetchGoodreadsBookDetails } from '@/lib/goodreads-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { detail: 'A Goodreads book URL is required (parameter "url").' },
        { status: 400 }
      );
    }

    const data = await fetchGoodreadsBookDetails(url);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to fetch Goodreads details.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const url = body?.url;

    if (!url) {
      return NextResponse.json(
        { detail: 'A Goodreads book URL is required in request body.' },
        { status: 400 }
      );
    }

    const data = await fetchGoodreadsBookDetails(url);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to fetch Goodreads details.' },
      { status: 500 }
    );
  }
}
