export interface ManifestGrammarUnit {
  unit: number;
  title: string;
  filename: string;
  drive_file_id: string;
}

export const DEFAULT_DRIVE_FOLDER_ID = '1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd';
export const DEFAULT_DRIVE_URL = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;
export const DEFAULT_COURSE_TITLE = 'Destination B1: English Grammar';
export const DEFAULT_COURSE_DESC =
  'Comprehensive English Grammar curriculum based on Destination B1 units (28 grammar quizzes).';
export const DEFAULT_COURSE_BANNER =
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop';
export const DEFAULT_PROMPT_CHAT_URL =
  process.env.NEXT_PUBLIC_PROMPT_CHAT_URL || 'https://chatgpt.com';

// Sample Book Manifest Constants (Keach Hagey - The Optimist)
export const SAMPLE_BOOK_DRIVE_FOLDER_ID = '13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT';
export const SAMPLE_BOOK_DRIVE_URL = `https://drive.google.com/drive/folders/${SAMPLE_BOOK_DRIVE_FOLDER_ID}`;
export const SAMPLE_BOOK_TITLE = 'The Optimist: Sam Altman, OpenAI, and the Race to Invent the Future';
export const SAMPLE_BOOK_AUTHOR = 'Keach Hagey';
export const SAMPLE_BOOK_BANNER = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop';
export const SAMPLE_BOOK_GOODREADS_URL = 'https://www.goodreads.com/book/show/214138402';

export const PRESET_COURSE_BANNERS = [
  {
    id: 'grammar-books',
    title: 'Grammar & Books',
    url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'digital-ai',
    title: 'Digital Learning & AI',
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'pronunciation-comm',
    title: 'Classroom & Pronunciation',
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'writing-vocab',
    title: 'Writing & Vocabulary',
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800&auto=format&fit=crop',
  },
];

export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  return trimmed;
}

export function getDriveFolderUrl(idOrUrl: string): string {
  if (!idOrUrl) return '';
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) return idOrUrl;
  const folderId = extractDriveFolderId(idOrUrl);
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function getDriveFileUrl(idOrUrl: string): string {
  if (!idOrUrl) return '';
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) return idOrUrl;
  const fileId = extractDriveFolderId(idOrUrl);
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export const GRAMMAR_UNITS_MANIFEST: ManifestGrammarUnit[] = [
  { unit: 1, title: 'Present simple, present continuous, stative verbs', filename: 'grammar_unit-01_present-simple-present-continuous-stative-verbs_p005.pdf', drive_file_id: '1-zrdo1m1kvU9ql1bKGFKc7yN3k7PIZAj' },
  { unit: 2, title: 'Past simple, past continuous, used to', filename: 'grammar_unit-02_past-simple-past-continuous-used-to_p008.pdf', drive_file_id: '12K40J2Z87XEvNGHVl3_d2meuf4dADAne' },
  { unit: 4, title: 'Present perfect simple, present perfect continuous', filename: 'grammar_unit-04_present-perfect-simple-present-perfect-continuous_p017.pdf', drive_file_id: '1cXbSqf1WU3d_RPqSEd5AR1V-tG0n7GP3' },
  { unit: 5, title: 'Past perfect simple, past perfect continuous', filename: 'grammar_unit-05_past-perfect-simple-past-perfect-continuous_p020.pdf', drive_file_id: '1IkVB2_PJTHDkM6lCPvDMA66y8gFimJ19' },
  { unit: 7, title: 'Future time (present continuous, will, be going to, present simple)', filename: 'grammar_unit-07_future-time-present-continuous-will-be-going-to-present-simple_p029.pdf', drive_file_id: '1aSB90_b1vfQnsRQQzAjNRTKPrjPTgGtK' },
  { unit: 8, title: 'Prepositions of time and place', filename: 'grammar_unit-08_prepositions-of-time-and-place_p032.pdf', drive_file_id: '1c_5-0gr0Agg-EJpeP3hnpov1OWIM4vao' },
  { unit: 10, title: 'The passive 1', filename: 'grammar_unit-10_the-passive-1_p041.pdf', drive_file_id: '12SMHndaXyUswsignZVoCSbTpiuTHWYFW' },
  { unit: 11, title: 'The passive 2', filename: 'grammar_unit-11_the-passive-2_p044.pdf', drive_file_id: '1Iz_N2H8VeMueqNvkWdyr2Snnfg7mNnUX' },
  { unit: 13, title: 'Countable and uncountable nouns', filename: 'grammar_unit-13_countable-and-uncountable-nouns_p053.pdf', drive_file_id: '1gn_Q_UW-K3Q-nIToKG8-rQa7h5_vx_F4' },
  { unit: 14, title: 'Articles', filename: 'grammar_unit-14_articles_p056.pdf', drive_file_id: '1mtLeS5CyhohSU6zc5luyuuP7BYJk6tV9' },
  { unit: 16, title: 'Pronouns and possessive determiners', filename: 'grammar_unit-16_pronouns-and-possessive-determiners_p065.pdf', drive_file_id: '14t6Comw0Vv9jJ0XIsye8Clcc7PUsIXlB' },
  { unit: 17, title: 'Relative clauses', filename: 'grammar_unit-17_relative-clauses_p068.pdf', drive_file_id: '1rmhWNy8qAVCsQIcXBgHbjg9hPR9GpNuB' },
  { unit: 19, title: 'Modals 1: ability, permission, advice', filename: 'grammar_unit-19_modals-1-ability-permission-advice_p076.pdf', drive_file_id: '1PxmXroN-UJaNjfHneHZGLHFR6-pit71z' },
  { unit: 20, title: 'Modals 2: obligation, probability, possibility', filename: 'grammar_unit-20_modals-2-obligation-probability-possibility_p079.pdf', drive_file_id: '1PFLidQ168bktccKigqF0nVYsW5UB9ku-' },
  { unit: 22, title: 'Modals 3: the modal perfect', filename: 'grammar_unit-22_modals-3-the-modal-perfect_p092.pdf', drive_file_id: '1g-c9piWk-BlHAhxBRuBj0fvEDCFUCyc2' },
  { unit: 23, title: 'Questions, question tags, indirect questions', filename: 'grammar_unit-23_questions-question-tags-indirect-questions_p095.pdf', drive_file_id: '1UE2lg7RiE4KyPFRfGXC7tod48y03Djhe' },
  { unit: 25, title: 'So and such, too and enough', filename: 'grammar_unit-25_so-and-such-too-and-enough_p104.pdf', drive_file_id: '18dPUXTTK0SMCFp6gDdX91rr-w-GKU8zg' },
  { unit: 26, title: 'Comparatives and superlatives', filename: 'grammar_unit-26_comparatives-and-superlatives_p107.pdf', drive_file_id: '1w1SDR1jdYnBpd3cZylDBAWCFQPBpJtiS' },
  { unit: 28, title: 'Conditionals 1: (zero, first, second)', filename: 'grammar_unit-28_conditionals-1-zero-first-second_p116.pdf', drive_file_id: '1i7erdqtgFHeaKVa6JhY0EqsTxhvEzpXz' },
  { unit: 29, title: 'Conditionals 2: (third)', filename: 'grammar_unit-29_conditionals-2-third_p119.pdf', drive_file_id: '1lfV2ALD7FCw6j0SkYKphINTU6NTAzmk3' },
  { unit: 31, title: 'Reported speech', filename: 'grammar_unit-31_reported-speech_p128.pdf', drive_file_id: '1ZtIyPGGEBKGYXS1SVA26QTSZwPLjGpwL' },
  { unit: 32, title: 'Reported questions, orders, requests', filename: 'grammar_unit-32_reported-questions-orders-requests_p131.pdf', drive_file_id: '1AgJXZ-A0qdDDT-29oUIqgDdZG3RZRWUu' },
  { unit: 34, title: 'Direct and indirect objects', filename: 'grammar_unit-34_direct-and-indirect-objects_p138.pdf', drive_file_id: '1srkWQT4-WGbxJzKl4Vb5kV88088cPCdA' },
  { unit: 35, title: 'wish', filename: 'grammar_unit-35_wish_p141.pdf', drive_file_id: '1HFs78UwsL35oaGkP5fgVd0naEBIgTBUU' },
  { unit: 37, title: '-ing and infinitive', filename: 'grammar_unit-37_ing-and-infinitive_p150.pdf', drive_file_id: '12WDDOJc3JjTP55Xfk4s23OLRi2UsoX3T' },
  { unit: 38, title: 'Both, either, neither, so, nor', filename: 'grammar_unit-38_both-either-neither-so-nor_p153.pdf', drive_file_id: '17WlF_UZq9-V_nDBlMU2jKoCbmj_9V0H5' },
  { unit: 40, title: 'Connectives', filename: 'grammar_unit-40_connectives_p162.pdf', drive_file_id: '1j9QS_OlltcAzW4_jbW0694MNIKwFllOL' },
  { unit: 41, title: 'The causative', filename: 'grammar_unit-41_the-causative_p165.pdf', drive_file_id: '1T9iFUFFzJITspwQGFAlCr2DruB3KeJI1' },
];
