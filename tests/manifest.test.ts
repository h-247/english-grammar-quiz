import {
  GRAMMAR_UNITS_MANIFEST,
  DEFAULT_DRIVE_FOLDER_ID,
  extractDriveFolderId,
  getDriveFolderUrl,
  getDriveFileUrl,
} from '../lib/course-manifest';

describe('Grammar Units Manifest & Drive Link Helpers', () => {
  it('contains all 28 grammar units from Destination B1', () => {
    expect(GRAMMAR_UNITS_MANIFEST.length).toBe(28);
  });

  it('has unique unit numbers and valid drive file IDs', () => {
    const unitNums = new Set<number>();
    for (const item of GRAMMAR_UNITS_MANIFEST) {
      expect(item.unit).toBeGreaterThan(0);
      expect(unitNums.has(item.unit)).toBe(false);
      unitNums.add(item.unit);

      expect(item.title).toBeTruthy();
      expect(item.filename).toMatch(/\.pdf$/);
      expect(item.drive_file_id).toBeTruthy();
    }
  });

  it('has the correct default Google Drive folder ID', () => {
    expect(DEFAULT_DRIVE_FOLDER_ID).toBe('1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd');
  });

  it('resolves Google Drive folder and file links correctly for copy feature', () => {
    const folderId = '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd';
    expect(extractDriveFolderId(`https://drive.google.com/drive/folders/${folderId}`)).toBe(folderId);
    expect(getDriveFolderUrl(folderId)).toBe(`https://drive.google.com/drive/folders/${folderId}`);
    expect(getDriveFolderUrl(`https://drive.google.com/drive/folders/${folderId}`)).toBe(
      `https://drive.google.com/drive/folders/${folderId}`
    );

    const fileId = '1-zrdo1m1kvU9ql1bKGFKc7yN3k7PIZAj';
    expect(getDriveFileUrl(fileId)).toBe(`https://drive.google.com/file/d/${fileId}/view`);
    expect(getDriveFileUrl(`https://drive.google.com/file/d/${fileId}/view`)).toBe(
      `https://drive.google.com/file/d/${fileId}/view`
    );
  });
});
