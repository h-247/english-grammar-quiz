import { NextResponse } from 'next/server';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { listDriveFolderFiles, fetchDriveFolderMetadata, clearDriveCache } from '@/lib/gdrive-service';

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const body = (await request.json().catch(() => ({}))) as any;
    const testFolderId = body.folder_id || '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd';

    clearDriveCache();
    const metadata = await fetchDriveFolderMetadata(testFolderId);
    const files = await listDriveFolderFiles(testFolderId, { forceRefresh: true });

    return NextResponse.json({
      success: true,
      folder_name: metadata?.name || 'Drive Folder',
      files_found: files.length,
      sample_files: files.slice(0, 3).map((f) => f.name),
      message: `Successfully connected to Google Drive! Found ${files.length} quiz files in folder "${metadata?.name || 'Folder'}".`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to authenticate with Google Drive.',
      },
      { status: 400 }
    );
  }
}
