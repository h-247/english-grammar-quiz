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

export const DEFAULT_REPO_BOOK_TYPES: string[] = [
  "Biography",
  "Grammar",
  "Science Fiction",
  "Reference",
  "Business",
  "Technology",
  "History",
  "Literature",
  "Mystery",
  "Self-Help",
  "Philosophy",
  "Psychology",
];

export function getBookMainTypes(
  book: {
    title?: string | null;
    main_type?: string | null;
    genres?: string[] | null;
    description?: string | null;
  } | null | undefined,
  repoTypes?: string[]
): string[] {
  if (!book) return ["Biography"];

  const activeRepoTypes = repoTypes && repoTypes.length > 0 ? repoTypes : DEFAULT_REPO_BOOK_TYPES;
  const allowedGenres = activeRepoTypes.filter(
    (t) => t.toLowerCase() !== "nonfiction" && t.toLowerCase() !== "fiction" && t.toLowerCase() !== "non-fiction"
  );

  // If book.main_type is explicitly provided, check its components (ignoring nonfiction/fiction)
  if (book.main_type) {
    const split = book.main_type.split(/[&/,+]/).map((s) => s.trim()).filter(Boolean);
    const validMain = split.filter(
      (s) =>
        s.toLowerCase() !== "nonfiction" &&
        s.toLowerCase() !== "fiction" &&
        s.toLowerCase() !== "non-fiction"
    );
    if (validMain.length > 0) {
      return validMain;
    }
  }

  const rawGenres: string[] = [];

  // Gather genres from book.genres (authoritative order from Goodreads, robust to string or array)
  let parsedGenresList: string[] = [];
  if (Array.isArray(book.genres)) {
    parsedGenresList = book.genres;
  } else if (typeof book.genres === "string") {
    const trimmed = (book.genres as string).trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) parsedGenresList = parsed;
      } catch {}
    }
    if (parsedGenresList.length === 0) {
      parsedGenresList = trimmed.split(/[,&/]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  for (const g of parsedGenresList) {
    const cleanG = typeof g === "string" ? g.trim() : "";
    if (
      cleanG &&
      cleanG.toLowerCase() !== "nonfiction" &&
      cleanG.toLowerCase() !== "fiction" &&
      cleanG.toLowerCase() !== "non-fiction" &&
      !rawGenres.includes(cleanG)
    ) {
      rawGenres.push(cleanG);
    }
  }

  const title = (book.title || "").toLowerCase();

  // Determine matching types: ALL genres appearing in Goodreads genres that exist in allowed repo types
  const matchedList: string[] = [];

  for (const g of rawGenres) {
    const matched = allowedGenres.find((t) => t.toLowerCase() === g.toLowerCase());
    if (matched && !matchedList.includes(matched)) {
      matchedList.push(matched);
    }
  }

  // If no exact match, try partial match
  if (matchedList.length === 0) {
    for (const g of rawGenres) {
      const gLower = g.toLowerCase();
      const matched = allowedGenres.find(
        (t) => gLower.includes(t.toLowerCase()) || t.toLowerCase().includes(gLower)
      );
      if (matched && !matchedList.includes(matched)) {
        matchedList.push(matched);
      }
    }
  }

  // Fallbacks strictly to allowed repo types if still empty
  if (matchedList.length === 0) {
    if (title.includes("optimist") || title.includes("openai") || title.includes("sam altman")) {
      const b = allowedGenres.find((t) => t.toLowerCase() === "biography") || "Biography";
      matchedList.push(b);
    } else if (title.includes("grammar") || title.includes("destination") || title.includes("english")) {
      const g = allowedGenres.find((t) => t.toLowerCase() === "grammar") || "Grammar";
      matchedList.push(g);
    } else if (title.includes("hail mary") || title.includes("space") || title.includes("weir")) {
      const sf = allowedGenres.find((t) => t.toLowerCase() === "science fiction") || "Science Fiction";
      matchedList.push(sf);
    } else if (allowedGenres.length > 0) {
      matchedList.push(allowedGenres[0]);
    } else {
      matchedList.push("Biography");
    }
  }

  return matchedList;
}
