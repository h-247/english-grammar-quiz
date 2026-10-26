import { describe, it, expect } from 'vitest';
import {
  getAuthenticatedUserOrLocal,
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from '../app/chatgpt-auth';
import { fetchDriveFolderMetadata, listDriveFolderFiles } from '../lib/gdrive-service';

describe('Auth & Multi-User Isolation Defaults', () => {
  it('falls back to local-user when auth headers are missing', async () => {
    const user = await getAuthenticatedUserOrLocal();
    expect(user.userId).toBe('local-user');
    expect(user.displayName).toBe('Local User');
    expect(user.email).toBe('local-user@chatgpt.internal');
  });

  it('builds safe sign-in and sign-out redirect paths', () => {
    expect(chatGPTSignInPath('/courses/123')).toBe(
      '/signin-with-chatgpt?return_to=%2Fcourses%2F123'
    );
    expect(chatGPTSignOutPath('/courses')).toBe(
      '/signout-with-chatgpt?return_to=%2Fcourses'
    );
    // Disallows external redirects (open redirect protection)
    expect(chatGPTSignInPath('https://malicious.com')).toBe(
      '/signin-with-chatgpt?return_to=%2F'
    );
    expect(chatGPTSignInPath('//malicious.com')).toBe(
      '/signin-with-chatgpt?return_to=%2F'
    );
  });

  it('handles Google Drive metadata fallback gracefully when offline', async () => {
    const meta = await fetchDriveFolderMetadata('1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd');
    expect(meta).not.toBeNull();
    expect(meta?.name).toBe('grammar');
  });

  it('returns empty array when listing unknown folder without tokens', async () => {
    const files = await listDriveFolderFiles('non_existent_folder_id');
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBe(0);
  });
});
