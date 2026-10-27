import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const DEFAULT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
});

function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
  }
  return `${padZero(m)}:${padZero(s)}`;
}

export function formatDate(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return DEFAULT_DATE_FORMATTER.format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return SHORT_DATE_FORMATTER.format(d);
  } catch {
    return isoString;
  }
}


export function getBookGoodreadsUrl(book: {
  title?: string | null;
  goodreads_url?: string | null;
} | null | undefined): string {
  if (!book) return 'https://www.goodreads.com';
  const url = (book.goodreads_url || '').trim();
  if (url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }
  const title = (book.title || '').trim();
  if (title) {
    return `https://www.goodreads.com/search?q=${encodeURIComponent(title)}`;
  }
  return 'https://www.goodreads.com';
}

export function getAuthorGoodreadsUrl(book: {
  author?: string | null;
  author_goodreads_url?: string | null;
} | null | undefined): string | null {
  if (!book) return null;
  const url = (book.author_goodreads_url || '').trim();
  if (url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }
  const author = (book.author || '').trim();
  if (author) {
    return `https://www.goodreads.com/search?q=${encodeURIComponent(author)}`;
  }
  return null;
}

export function getBookMainTypes(book: {
  title?: string | null;
  main_type?: string | null;
  genres?: string[] | null;
} | null | undefined): [string, string] {
  if (!book) return ['Nonfiction', 'Literature'];

  const types: string[] = [];

  if (book.main_type) {
    const split = book.main_type.split(/[&/,+]/).map((s) => s.trim()).filter(Boolean);
    for (const s of split) {
      if (!types.includes(s)) types.push(s);
    }
  }

  if (Array.isArray(book.genres)) {
    for (const g of book.genres) {
      const cleanG = typeof g === 'string' ? g.trim() : '';
      if (cleanG && !types.includes(cleanG)) {
        types.push(cleanG);
      }
    }
  }

  const title = (book.title || '').toLowerCase();
  if (types.length < 2) {
    if (title.includes('grammar') || title.includes('english') || title.includes('destination')) {
      if (!types.includes('Grammar')) types.push('Grammar');
      if (!types.includes('Reference')) types.push('Reference');
    } else if (title.includes('optimist') || title.includes('openai') || title.includes('altman')) {
      if (!types.includes('Nonfiction')) types.push('Nonfiction');
      if (!types.includes('Business')) types.push('Business');
    } else if (title.includes('hail mary') || title.includes('space') || title.includes('weir')) {
      if (!types.includes('Science Fiction')) types.push('Science Fiction');
      if (!types.includes('Fiction')) types.push('Fiction');
    } else if (types.length === 1) {
      if (types[0] === 'Nonfiction') types.push('Business');
      else if (types[0] === 'Science Fiction') types.push('Fiction');
      else if (types[0] === 'Fiction') types.push('Literature');
      else types.push('Literature');
    } else {
      types.push('Nonfiction', 'Literature');
    }
  }

  return [types[0], types[1]];
}
