import { NextResponse } from 'next/server';
import { extractDriveFolderId } from '@/lib/course-manifest';
import { fetchDriveFolderMetadata } from '@/lib/gdrive-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const urlOrId = searchParams.get('url') || searchParams.get('id') || '';
    if (!urlOrId) {
      return NextResponse.json(
        { detail: 'Missing url or id parameter' },
        { status: 400 }
      );
    }

    const folderId = extractDriveFolderId(urlOrId);
    if (!folderId) {
      return NextResponse.json(
        { detail: 'Invalid Google Drive folder link or ID' },
        { status: 400 }
      );
    }

    const meta = await fetchDriveFolderMetadata(folderId);
    return NextResponse.json({
      folder_id: folderId,
      name: meta?.name || null,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
