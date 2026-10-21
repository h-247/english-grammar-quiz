import { describe, it, expect } from 'vitest';
import { normalizeAnswer, evaluateBlank } from '../lib/grading';

describe('Grading Logic & Answer Normalization', () => {
  it('normalizes simple lowercase strings', () => {
    expect(normalizeAnswer('hello')).toBe('hello');
  });

  it('trims leading and trailing whitespace by default', () => {
    expect(normalizeAnswer('  play  ')).toBe('play');
  });

  it('collapses internal whitespace by default', () => {
    expect(normalizeAnswer('has   been    running')).toBe('has been running');
  });

  it('converts to lowercase when caseSensitive is false (default)', () => {
    expect(normalizeAnswer('Plays')).toBe('plays');
    expect(normalizeAnswer('DOES NOT')).toBe('does not');
  });

  it('respects caseSensitive when set to true', () => {
    expect(normalizeAnswer('Plays', { caseSensitive: true })).toBe('Plays');
    expect(normalizeAnswer('plays', { caseSensitive: true })).toBe('plays');
  });

  it('handles NFKC unicode normalization', () => {
    // ligature fi: \uFB01 -> "fi"
    expect(normalizeAnswer('\uFB01nish')).toBe('finish');
    // full-width letters: ｗｏｒｋ -> work
    expect(normalizeAnswer('\uFF57\uFF4F\uFF52\uFF4B')).toBe('work');
  });

  it('evaluates blanks correctly against accepted answers', () => {
    const accepted = ['play', 'plays'];
    expect(evaluateBlank('play', accepted)).toBe(true);
    expect(evaluateBlank('Play', accepted)).toBe(true);
    expect(evaluateBlank('  plays  ', accepted)).toBe(true);
    expect(evaluateBlank('playing', accepted)).toBe(false);
  });

  it('rejects empty, null, or whitespace-only answers', () => {
    const accepted = ['play'];
    expect(evaluateBlank('', accepted)).toBe(false);
    expect(evaluateBlank('   ', accepted)).toBe(false);
    expect(evaluateBlank(null, accepted)).toBe(false);
    expect(evaluateBlank(undefined, accepted)).toBe(false);
  });
});
