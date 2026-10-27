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
    if (title.toLowerCase().includes('optimist')) {
      return 'https://www.goodreads.com/book/show/223400731-the-optimist';
    }
    if (title.toLowerCase().includes('hail mary')) {
      return 'https://www.goodreads.com/book/show/54493401-project-hail-mary';
    }
    if (title.toLowerCase().includes('grammar') || title.toLowerCase().includes('destination')) {
      return 'https://www.goodreads.com/book/show/1598466.Destination_B1';
    }
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
    if (author.toLowerCase().includes('keach') && author.toLowerCase().includes('hagey')) {
      return 'https://www.goodreads.com/author/show/16995547.Keach_Hagey';
    }
    if (author.toLowerCase().includes('andy') && author.toLowerCase().includes('weir')) {
      return 'https://www.goodreads.com/author/show/6540057.Andy_Weir';
    }
    if (author.toLowerCase().includes('raymond') || author.toLowerCase().includes('mann')) {
      return 'https://www.goodreads.com/author/show/53950.Raymond_Murphy';
    }
    return `https://www.goodreads.com/search?q=${encodeURIComponent(author)}`;
  }
  return null;
}

export function getBookMainTypes(book: {
  title?: string | null;
  main_type?: string | null;
  genres?: string[] | null;
} | null | undefined): [string, string] {
  if (!book) return ['Biography', 'Artificial Intelligence'];

  const types: string[] = [];
  const title = (book.title || '').toLowerCase();

  // For The Optimist (Sam Altman / OpenAI), Goodreads lists Biography as first genre
  if (title.includes('optimist') || title.includes('sam altman') || title.includes('openai')) {
    types.push('Biography', 'Artificial Intelligence');
  }

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

  if (types.length < 2) {
    if (title.includes('grammar') || title.includes('english') || title.includes('destination')) {
      if (!types.includes('Grammar')) types.push('Grammar');
      if (!types.includes('Reference')) types.push('Reference');
    } else if (title.includes('optimist') || title.includes('openai') || title.includes('altman')) {
      if (!types.includes('Biography')) types.push('Biography');
      if (!types.includes('Artificial Intelligence')) types.push('Artificial Intelligence');
    } else if (title.includes('hail mary') || title.includes('space') || title.includes('weir')) {
      if (!types.includes('Science Fiction')) types.push('Science Fiction');
      if (!types.includes('Fiction')) types.push('Fiction');
    } else if (types.length === 1) {
      if (types[0] === 'Biography') types.push('Artificial Intelligence');
      else if (types[0] === 'Nonfiction') types.push('Business');
      else if (types[0] === 'Science Fiction') types.push('Fiction');
      else if (types[0] === 'Fiction') types.push('Literature');
      else types.push('Literature');
    } else {
      types.push('Biography', 'Artificial Intelligence');
    }
  }

  return [types[0], types[1]];
}
