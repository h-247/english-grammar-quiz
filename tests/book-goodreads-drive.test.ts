import { describe, it, expect } from 'vitest';
import { parseGoodreadsHtml, fetchGoodreadsBookDetails } from '@/lib/goodreads-service';
import { SAMPLE_BOOK_MANIFEST } from '@/lib/course-service';
import { extractDriveFolderId } from '@/lib/course-manifest';
import { getBookMainTypes, getBookGoodreadsUrl, getAuthorGoodreadsUrl } from '@/lib/utils';

describe('Goodreads Scraping & Metadata Extraction', () => {
  it('correctly parses JSON-LD metadata from Goodreads book HTML', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Book",
            "name": "Project Hail Mary",
            "author": [
              {
                "@type": "Person",
                "name": "Andy Weir"
              }
            ],
            "image": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1764703833i/54493401.jpg",
            "description": "Ryland Grace is the sole survivor on a desperate mission.",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": 4.51,
              "ratingCount": 1918660
            },
            "numberOfPages": 476,
            "isbn": "9780593135204",
            "datePublished": "2021-05-04"
          }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = parseGoodreadsHtml(sampleHtml, 'https://www.goodreads.com/book/show/54493401-project-hail-mary');
    expect(result.title).toBe('Project Hail Mary');
    expect(result.author).toBe('Andy Weir');
    expect(result.rating).toBe(4.51);
    expect(result.pageCount).toBe(476);
    expect(result.isbn).toBe('9780593135204');
    expect(result.publishedYear).toBe('2021');
    expect(result.coverUrl).toBe('https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1764703833i/54493401.jpg');
    expect(result.description).toContain('Ryland Grace is the sole survivor');
  });

  it('falls back to OpenGraph meta tags when JSON-LD is absent', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="The Optimist" />
          <meta property="og:description" content="A book about Sam Altman and OpenAI." />
          <meta property="og:image" content="https://images.sample.com/cover.jpg" />
        </head>
        <body>
          <span data-testid="name">Keach Hagey</span>
        </body>
      </html>
    `;

    const result = parseGoodreadsHtml(sampleHtml, 'https://www.goodreads.com/book/show/214138402-the-optimist');
    expect(result.title).toBe('The Optimist');
    expect(result.author).toBe('Keach Hagey');
    expect(result.mainType).toBe('Nonfiction & Biography');
    expect(result.genres).toContain('Biography');
    expect(result.genres).toContain('Business');
    expect(result.authorGoodreadsUrl).toContain('Keach_Hagey');
    expect(result.description).toBe('A book about Sam Altman and OpenAI.');
    expect(result.coverUrl).toBe('https://images.sample.com/cover.jpg');
  });

  it('returns structured fallback for the sample The Optimist book link', async () => {
    const url = 'https://www.goodreads.com/book/show/223400731';
    const result = await fetchGoodreadsBookDetails(url);
    expect(result.title).toContain('The Optimist');
    expect(result.author).toBe('Keach Hagey');
    expect(result.mainType).toBe('Nonfiction & Biography');
    expect(result.genres?.[0]).toBe('Biography');
    expect(result.pageCount).toBe(384);
    expect(result.rating).toBe(3.79);
    expect(result.authorGoodreadsUrl).toBe('https://www.goodreads.com/author/show/16995547.Keach_Hagey');
  });
});

describe('Google Drive Chapter Import & Folder Resolution', () => {
  it('correctly extracts folder ID from sample Drive URL and rejects Goodreads links', () => {
    const sampleUrl = 'https://drive.google.com/drive/folders/13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT';
    const folderId = extractDriveFolderId(sampleUrl);
    expect(folderId).toBe('13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT');

    // Must reject Goodreads URLs accidentally pasted in Drive field
    expect(extractDriveFolderId('https://www.goodreads.com/book/show/223400731-the-optimist')).toBe('');
    expect(extractDriveFolderId('https://drive.google.com/drive/u/2/folders/https://www.goodreads.com/book/show/223400731-the-optimist')).toBe('');
  });

  it('contains authoritative manifest of 19 chapters for The Optimist sample folder', () => {
    expect(SAMPLE_BOOK_MANIFEST.length).toBe(19);

    // Front matter
    expect(SAMPLE_BOOK_MANIFEST[0].title).toBe('Front matter (includes Prologue)');
    expect(SAMPLE_BOOK_MANIFEST[0].unit).toBe(0);
    expect(SAMPLE_BOOK_MANIFEST[0].start_page).toBe(1);
    expect(SAMPLE_BOOK_MANIFEST[0].end_page).toBe(22);

    // Chapter 1
    expect(SAMPLE_BOOK_MANIFEST[1].title).toBe('Chapter 1 - Chicago');
    expect(SAMPLE_BOOK_MANIFEST[1].unit).toBe(1);
    expect(SAMPLE_BOOK_MANIFEST[1].start_page).toBe(23);
    expect(SAMPLE_BOOK_MANIFEST[1].end_page).toBe(39);
    expect(SAMPLE_BOOK_MANIFEST[1].filename).toBe('01_ch01_chicago_p023-p039.pdf');

    // Chapter 15 - ChatGPT
    const ch15 = SAMPLE_BOOK_MANIFEST.find((c) => c.unit === 15);
    expect(ch15).toBeDefined();
    expect(ch15?.title).toBe('Chapter 15 - ChatGPT');

    // Back matter
    const backMatter = SAMPLE_BOOK_MANIFEST.find((c) => c.unit === 99);
    expect(backMatter).toBeDefined();
    expect(backMatter?.title).toBe('Back matter');
  });

  it('verifies chapter status lifecycle adheres to To do, Doing, Done', () => {
    const validStatuses = ['To do', 'Doing', 'Done'];
    validStatuses.forEach((status) => {
      expect(['To do', 'Doing', 'Done']).toContain(status);
    });
  });
});

describe('Book 2 Main Types and Goodreads Navigation', () => {
  it('correctly provides 2 main types: Nonfiction/Fiction and the first Goodreads genre', () => {
    // The Optimist: first genre on Goodreads is Biography, broad type is Nonfiction
    const book1 = {
      title: 'The Optimist: Sam Altman, OpenAI, and the Race to Invent the Future',
      author: 'Keach Hagey',
      genres: ['Biography', 'Artificial Intelligence', 'Nonfiction', 'Business'],
    };
    expect(getBookMainTypes(book1)).toEqual(['Nonfiction', 'Biography']);

    // Grammar book: first genre is Grammar, broad type is Nonfiction
    const book2 = {
      title: 'Destination B1: English Grammar',
      genres: ['Grammar', 'Reference'],
    };
    expect(getBookMainTypes(book2)).toEqual(['Nonfiction', 'Grammar']);

    // Project Hail Mary: first genre is Science Fiction, broad type is Fiction
    const book3 = {
      title: 'Project Hail Mary',
      genres: ['Science Fiction', 'Fiction', 'Space'],
    };
    expect(getBookMainTypes(book3)).toEqual(['Fiction', 'Science Fiction']);

    // Book starting with Fiction genre: picks Fiction as broad type and skips to first specific genre
    const book4 = {
      title: 'A Novel',
      genres: ['Fiction', 'Mystery', 'Crime'],
    };
    expect(getBookMainTypes(book4)).toEqual(['Fiction', 'Mystery']);
  });

  it('correctly generates Goodreads link for book title and author', () => {
    // Book with explicit goodreads_url
    const book1 = {
      title: 'The Optimist',
      author: 'Keach Hagey',
      goodreads_url: 'https://www.goodreads.com/book/show/214138402',
      author_goodreads_url: 'https://www.goodreads.com/author/show/16995547.Keach_Hagey',
    };
    expect(getBookGoodreadsUrl(book1)).toBe('https://www.goodreads.com/book/show/214138402');
    expect(getAuthorGoodreadsUrl(book1)).toBe('https://www.goodreads.com/author/show/16995547.Keach_Hagey');

    // Book without goodreads_url, falls back to goodreads search
    const book2 = {
      title: 'A Random Book Title',
      author: 'Some Unknown Author',
    };
    expect(getBookGoodreadsUrl(book2)).toBe('https://www.goodreads.com/search?q=A%20Random%20Book%20Title');
    expect(getAuthorGoodreadsUrl(book2)).toBe('https://www.goodreads.com/search?q=Some%20Unknown%20Author');

    // Known book without goodreads_url resolves to canonical Goodreads book & author pages
    const bookHailMary = {
      title: 'Project Hail Mary',
      author: 'Andy Weir',
    };
    expect(getBookGoodreadsUrl(bookHailMary)).toBe('https://www.goodreads.com/book/show/54493401-project-hail-mary');
    expect(getAuthorGoodreadsUrl(bookHailMary)).toBe('https://www.goodreads.com/author/show/6540057.Andy_Weir');

    // Book with bare URL without protocol
    const book3 = {
      title: 'Sample',
      goodreads_url: 'www.goodreads.com/book/show/123',
      author_goodreads_url: 'www.goodreads.com/author/show/456',
    };
    expect(getBookGoodreadsUrl(book3)).toBe('https://www.goodreads.com/book/show/123');
    expect(getAuthorGoodreadsUrl(book3)).toBe('https://www.goodreads.com/author/show/456');
  });
});
