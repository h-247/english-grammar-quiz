import { describe, it, expect } from 'vitest';
import { calculateAttemptTopicMastery } from '../lib/attempt-service';
import {
  fetchDriveFolderMetadata,
  clearDriveCache,
} from '../lib/gdrive-service';

describe('Learning Mastery & Drive Resilience', () => {
  it('calculates topic mastery percentages and levels accurately', () => {
    const detailedQuestions = [
      {
        topic: 'Present Continuous',
        blanks: [{ is_correct: true }, { is_correct: true }],
      },
      {
        topic: 'Present Continuous',
        blanks: [{ is_correct: true }],
      },
      {
        topic: 'Past Simple',
        blanks: [{ is_correct: true }, { is_correct: false }],
      },
      {
        topic: 'Stative Verbs',
        blanks: [{ is_correct: false }, { is_correct: false }],
      },
    ];

    const results = calculateAttemptTopicMastery(detailedQuestions);

    expect(results).toHaveLength(3);

    // Sorted by lowest percentage first
    expect(results[0].topic).toBe('Stative Verbs');
    expect(results[0].percentage).toBe(0);
    expect(results[0].masteryLevel).toBe('needs_practice');

    expect(results[1].topic).toBe('Past Simple');
    expect(results[1].percentage).toBe(50);
    expect(results[1].masteryLevel).toBe('developing');

    expect(results[2].topic).toBe('Present Continuous');
    expect(results[2].percentage).toBe(100);
    expect(results[2].masteryLevel).toBe('mastered');
  });

  it('handles empty questions gracefully for topic mastery', () => {
    const results = calculateAttemptTopicMastery([]);
    expect(results).toEqual([]);
  });

  it('caches Drive metadata in memory to prevent redundant API calls', async () => {
    clearDriveCache();
    const folderId = '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd';

    const first = await fetchDriveFolderMetadata(folderId);
    expect(first).not.toBeNull();
    expect(first?.name).toBe('grammar');

    // Second call hits in-memory cache immediately
    const second = await fetchDriveFolderMetadata(folderId);
    expect(second).toEqual(first);
  });
});
