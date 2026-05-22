import fs from 'fs';
import path from 'path';

// List of canonical book names used in bsb.txt
export const BSB_CANONICAL_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
  'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

// Helper to normalize strings for comparison
function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[\s\.\-_]+/g, '');
}

// Build the alias mapping
const BOOK_ALIASES: Record<string, string> = {};

// Initialize with canonical names mapping to themselves
for (const book of BSB_CANONICAL_BOOKS) {
  BOOK_ALIASES[normalizeString(book)] = book;
}

// Add common abbreviation mappings
const rawAliases: Record<string, string[]> = {
  'Genesis': ['gen', 'gn'],
  'Exodus': ['exo', 'ex'],
  'Leviticus': ['lev', 'lv'],
  'Numbers': ['num', 'nm', 'nu'],
  'Deuteronomy': ['deut', 'dt', 'de'],
  'Joshua': ['josh', 'jos', 'jsh'],
  'Judges': ['judg', 'jdg', 'jg'],
  'Ruth': ['rut', 'ru'],
  '1 Samuel': ['1samuel', '1sam', '1sa', '1s', 'isamuel', 'isam', 'isa', '1stsamuel', 'firstsamuel'],
  '2 Samuel': ['2samuel', '2sam', '2sa', '2s', 'iisamuel', 'iisam', 'iisa', '2ndsamuel', 'secondsamuel'],
  '1 Kings': ['1kings', '1ki', '1k', 'ikings', 'iki', '1stkings', 'firstkings'],
  '2 Kings': ['2kings', '2ki', '2k', 'iikings', 'iiki', '2ndkings', 'secondkings'],
  '1 Chronicles': ['1chronicles', '1chron', '1chr', '1ch', 'ichronicles', 'ichron', 'ichr', 'ich', '1stchronicles', 'firstchronicles'],
  '2 Chronicles': ['2chronicles', '2chron', '2chr', '2ch', 'iichronicles', 'iichron', 'iichr', 'iich', '2ndchronicles', 'secondchronicles'],
  'Ezra': ['ezr', 'ez'],
  'Nehemiah': ['neh', 'ne'],
  'Esther': ['est', 'esth', 'es'],
  'Job': ['jb'],
  'Psalm': ['psalm', 'psalms', 'psa', 'ps'],
  'Proverbs': ['proverbs', 'prov', 'pro', 'pr'],
  'Ecclesiastes': ['ecclesiastes', 'eccles', 'ecc', 'ec'],
  'Song of Solomon': ['songofsolomon', 'songofsongs', 'song', 'songs', 'canticles', 'canticle', 'cant'],
  'Isaiah': ['isa', 'is'],
  'Jeremiah': ['jer', 'je'],
  'Lamentations': ['lam', 'la'],
  'Ezekiel': ['ezekiel', 'ezek', 'ezk', 'ez'],
  'Daniel': ['dan', 'dn', 'da'],
  'Hosea': ['hos', 'ho'],
  'Joel': ['jol', 'jl'],
  'Amos': ['amo', 'am'],
  'Obadiah': ['obadiah', 'obad', 'oba', 'ob'],
  'Jonah': ['jon', 'jnh'],
  'Micah': ['mic', 'mc'],
  'Nahum': ['nah', 'na'],
  'Habakkuk': ['hab', 'hb'],
  'Zephaniah': ['zephaniah', 'zeph', 'zep', 'zp'],
  'Haggai': ['hag', 'hg'],
  'Zechariah': ['zechariah', 'zech', 'zec', 'zc'],
  'Malachi': ['mal', 'ml'],
  'Matthew': ['matt', 'mat', 'mt'],
  'Mark': ['mrk', 'mk'],
  'Luke': ['luk', 'lk'],
  'John': ['jhn', 'jn', 'joh'],
  'Acts': ['act', 'ac'],
  'Romans': ['rom', 'ro', 'rm'],
  '1 Corinthians': ['1corinthians', '1cor', '1co', 'icorinthians', 'icor', 'ico', '1stcorinthians', 'firstcorinthians'],
  '2 Corinthians': ['2corinthians', '2cor', '2co', 'iicorinthians', 'iicor', 'iico', '2ndcorinthians', 'secondcorinthians'],
  'Galatians': ['gal', 'ga'],
  'Ephesians': ['eph', 'ep'],
  'Philippians': ['phil', 'php', 'ph'],
  'Colossians': ['col', 'co'],
  '1 Thessalonians': ['1thessalonians', '1thess', '1th', 'ithessalonians', 'ithess', 'ith', '1stthessalonians', 'firstthessalonians'],
  '2 Thessalonians': ['2thessalonians', '2thess', '2th', 'iithessalonians', 'iithess', 'iith', '2ndthessalonians', 'secondthessalonians'],
  '1 Timothy': ['1timothy', '1tim', '1ti', 'itimothy', 'itim', 'iti', '1sttimothy', 'firsttimothy'],
  '2 Timothy': ['2timothy', '2tim', '2ti', 'iitimothy', 'iitim', 'iiti', '2ndtimothy', 'secondtimothy'],
  'Titus': ['tit', 'ti'],
  'Philemon': ['philem', 'phm', 'pm'],
  'Hebrews': ['heb', 'he'],
  'James': ['jas', 'jam', 'ja'],
  '1 Peter': ['1peter', '1pet', '1pe', '1p', 'ipeter', 'ipet', 'ipe', '1stpeter', 'firstpeter'],
  '2 Peter': ['2peter', '2pet', '2pe', '2p', 'iipeter', 'iipet', 'iipe', '2ndpeter', 'secondpeter'],
  '1 John': ['1john', '1jn', '1j', 'ijohn', 'ijn', '1stjohn', 'firstjohn'],
  '2 John': ['2john', '2jn', '2j', 'iijohn', 'iijn', '2ndjohn', 'secondjohn'],
  '3 John': ['3john', '3jn', '3j', 'iiijohn', 'iiijn', '3rdjohn', 'thirdjohn'],
  'Jude': ['jud', 'jd'],
  'Revelation': ['rev', 're']
};

for (const [canonical, aliases] of Object.entries(rawAliases)) {
  for (const alias of aliases) {
    BOOK_ALIASES[normalizeString(alias)] = canonical;
  }
}

// Global cached BSB map
const globalForBsb = global as unknown as {
  bsbMap: Map<string, string> | undefined;
};

function getBsbMap(): Map<string, string> {
  if (globalForBsb.bsbMap) {
    return globalForBsb.bsbMap;
  }

  const map = new Map<string, string>();
  try {
    const filePath = path.join(process.cwd(), 'lib/data/bsb.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const ref = parts[0].trim();
      const text = parts[1].trim();
      // Store in map using lowercased reference as key (e.g. "genesis 1:1")
      map.set(ref.toLowerCase(), text);
    }
  } catch (error) {
    console.error('Failed to load bsb.txt:', error);
  }

  globalForBsb.bsbMap = map;
  return map;
}

export interface LocalVerse {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
}

/**
 * Resolves a book name string to its canonical BSB book name.
 */
export function getCanonicalBook(bookName: string): string | null {
  const norm = normalizeString(bookName);
  return BOOK_ALIASES[norm] || null;
}

/**
 * Fetches a single verse from the local BSB text file.
 */
export function getLocalBsbVerse(book: string, chapter: number, verse: number): LocalVerse | null {
  const canonicalBook = getCanonicalBook(book);
  if (!canonicalBook) return null;

  const bsbMap = getBsbMap();
  const lookupKey = `${canonicalBook.toLowerCase()} ${chapter}:${verse}`;
  const text = bsbMap.get(lookupKey);
  if (!text) return null;

  return { reference: `${canonicalBook} ${chapter}:${verse}`, text, book: canonicalBook, chapter, verse };
}

/**
 * Fetches a range of verses from the local BSB text file.
 * Returns all found verses between startVerse and endVerse (inclusive).
 */
export function getLocalBsbRange(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse: number,
): LocalVerse[] | null {
  const canonicalBook = getCanonicalBook(book);
  if (!canonicalBook) return null;

  const bsbMap = getBsbMap();
  const verses: LocalVerse[] = [];

  for (let v = startVerse; v <= endVerse; v++) {
    const key = `${canonicalBook.toLowerCase()} ${chapter}:${v}`;
    const text = bsbMap.get(key);
    if (text) {
      verses.push({ reference: `${canonicalBook} ${chapter}:${v}`, text, book: canonicalBook, chapter, verse: v });
    }
  }

  return verses.length > 0 ? verses : null;
}

/**
 * Fetches all verses of a chapter from the local BSB text file.
 * Scans verse numbers 1–200 and stops at the first miss after finding content.
 */
export function getLocalBsbChapter(book: string, chapter: number): LocalVerse[] | null {
  const canonicalBook = getCanonicalBook(book);
  if (!canonicalBook) return null;

  const bsbMap = getBsbMap();
  const verses: LocalVerse[] = [];

  for (let v = 1; v <= 200; v++) {
    const key = `${canonicalBook.toLowerCase()} ${chapter}:${v}`;
    const text = bsbMap.get(key);
    if (text) {
      verses.push({ reference: `${canonicalBook} ${chapter}:${v}`, text, book: canonicalBook, chapter, verse: v });
    } else if (verses.length > 0) {
      // Hit a gap after finding verses — chapter is complete
      break;
    }
  }

  return verses.length > 0 ? verses : null;
}
