import { Product, Store, Service } from './MarketplaceTypes';

export interface ParsedSearch {
  rawQuery: string;
  keywords: string[];
  category: string | null;
  maxPrice: number | null;
  minPrice: number | null;
  tags: string[];
  location: string | null;
  sortType: 'relevant' | 'price_low' | 'price_high' | 'newest';
}

const KNOWN_LOCATIONS = [
  'dhaka', 'chittagong', 'sylhet', 'gazipur', 'barishal', 'khulna', 'rajshahi',
  'banani', 'mirpur', 'gulshan', 'dhanmondi', 'uttara', 'mohammadpur', 'bashundhara'
];

/**
 * Heuristics-based client-side smart NLP query parser.
 * Supports statements like:
 * - "gaming laptop under 140000 BDT"
 * - "laptop below ৳50000"
 * - "laptop under 50000"
 * - "phone below 30k"
 * - "Fashion below 8000"
 * - "stores in Banani"
 * - "black shirt under 2000"
 */
export function parseNaturalLanguageQuery(query: string, currencyRate: number): ParsedSearch {
  const clean = query.toLowerCase().trim();
  const rate = currencyRate && currencyRate > 0 ? currencyRate : 1.0;
  const result: ParsedSearch = {
    rawQuery: query,
    keywords: [],
    category: null,
    maxPrice: null,
    minPrice: null,
    tags: [],
    location: null,
    sortType: 'relevant'
  };

  if (!clean) return result;

  // 1. Detect Price Boundaries (under / below / less than / cheaper than / max / budget)
  // Correctly handles: ৳, $, €, £, ₹, BDT, Tk, Taka
  const currencyPrefix = '(?:৳|\\$|€|£|₹|bdt|tk|taka)?\\s*';
  const currencySuffix = '\\s*(?:৳|\\$|€|£|₹|bdt|tk|taka)?';

  const maxPriceRegex = new RegExp(
    `(?:under|below|less\\s+than|cheaper\\s+than|max|maximum|budget)\\s*${currencyPrefix}([0-9,.]+)(k)?${currencySuffix}`,
    'i'
  );
  const maxPriceMatch = clean.match(maxPriceRegex);
  if (maxPriceMatch) {
    const numStr = maxPriceMatch[1].replace(/,/g, '');
    let numVal = parseFloat(numStr);
    if (maxPriceMatch[2]?.toLowerCase() === 'k') {
      numVal *= 1000;
    }
    if (!isNaN(numVal) && numVal > 0) {
      result.maxPrice = numVal / rate;
    }
  }

  // Symbol comparison: < 50000
  if (result.maxPrice === null) {
    const lessThanMatch = clean.match(/<\s*([0-9,.]+)(k)?/i);
    if (lessThanMatch) {
      let numVal = parseFloat(lessThanMatch[1].replace(/,/g, ''));
      if (lessThanMatch[2]?.toLowerCase() === 'k') numVal *= 1000;
      if (!isNaN(numVal) && numVal > 0) {
        result.maxPrice = numVal / rate;
      }
    }
  }

  // Min Price (above / over / more than / greater than / min / minimum / >)
  const minPriceRegex = new RegExp(
    `(?:above|over|more\\s+than|greater\\s+than|min|minimum)\\s*${currencyPrefix}([0-9,.]+)(k)?${currencySuffix}`,
    'i'
  );
  const minPriceMatch = clean.match(minPriceRegex);
  if (minPriceMatch) {
    const numStr = minPriceMatch[1].replace(/,/g, '');
    let numVal = parseFloat(numStr);
    if (minPriceMatch[2]?.toLowerCase() === 'k') {
      numVal *= 1000;
    }
    if (!isNaN(numVal) && numVal > 0) {
      result.minPrice = numVal / rate;
    }
  }

  if (result.minPrice === null) {
    const greaterThanMatch = clean.match(/>\s*([0-9,.]+)(k)?/i);
    if (greaterThanMatch) {
      let numVal = parseFloat(greaterThanMatch[1].replace(/,/g, ''));
      if (greaterThanMatch[2]?.toLowerCase() === 'k') numVal *= 1000;
      if (!isNaN(numVal) && numVal > 0) {
        result.minPrice = numVal / rate;
      }
    }
  }

  // 2. Detect Specific Locations WITHOUT eating arbitrary words (like "in black color")
  for (const loc of KNOWN_LOCATIONS) {
    const locRegex = new RegExp(`(?:in|near|around|at|within)\\s+(${loc})\\b`, 'i');
    const locMatch = clean.match(locRegex);
    if (locMatch) {
      result.location = loc;
      break;
    }
  }

  // 3. Category Detection mapping (only broad category indicator keywords)
  const categoryKeywords: Record<string, string[]> = {
    'Electronics': ['electronics', 'gadget', 'charger', 'hardware'],
    'Fashion': ['fashion', 'apparel', 'outerwear'],
    'Beauty': ['beauty', 'cosmetics', 'perfume', 'skincare', 'makeup', 'fragrance'],
    'Food': ['grocery', 'groceries', 'snacks'],
    'Furniture': ['furniture', 'decor'],
    'Services': ['services', 'freelancer', 'maintenance', 'repair']
  };

  for (const [catName, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => clean.includes(kw))) {
      result.category = catName;
      break;
    }
  }

  // 4. Sort type triggers
  if (clean.includes('cheapest') || clean.includes('low price') || clean.includes('price low')) {
    result.sortType = 'price_low';
  } else if (clean.includes('expensive') || clean.includes('premium') || clean.includes('price high')) {
    result.sortType = 'price_high';
  } else if (clean.includes('newest') || clean.includes('latest') || clean.includes('recent')) {
    result.sortType = 'newest';
  }

  // 5. Extract keywords safely
  let queryText = clean
    .replace(/(?:under|below|less\s+than|cheaper\s+than|max|maximum|budget|above|over|more\s+than|greater\s+than|min|minimum)\s*(?:৳|\$|€|£|₹|bdt|tk|taka)?\s*[0-9,.]+(?:k)?(?:\s*(?:৳|\$|€|£|₹|bdt|tk|taka))?/gi, '')
    .replace(/[<>]/g, '');

  // Only strip the exact detected location preposition, not arbitrary phrases
  if (result.location) {
    queryText = queryText.replace(new RegExp(`(?:in|near|around|at|within)\\s+${result.location}\\b`, 'gi'), '');
  }

  const stopWords = ['a', 'an', 'the', 'for', 'with', 'and', 'or', 'of', 'to', 'find', 'search', 'get', 'show', 'me', 'bdt', 'tk', 'taka'];
  const words = queryText.split(/\s+/).map(w => w.trim()).filter(Boolean);
  
  result.keywords = words.filter(w => !stopWords.includes(w) && w.length > 1);

  return result;
}

/**
 * Filter product listings based on a parsed search configuration
 */
export function filterProductsByNlp(
  products: Product[],
  parsed: ParsedSearch,
  selectedLocation: string
): Product[] {
  let list = [...products];

  // 1. Keyword search (names, descriptions, tags, storeName)
  if (parsed.keywords.length > 0) {
    const scoredList: Array<{ product: Product; score: number }> = [];

    for (const p of list) {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : (typeof p.tags === 'string' ? (p.tags as string).toLowerCase() : '');
      const storeName = (p.storeName || '').toLowerCase();
      const category = (p.category || '').toLowerCase();

      let matchCount = 0;
      let score = 0;

      for (const kw of parsed.keywords) {
        if (name.includes(kw)) {
          matchCount++;
          score += 50;
          if (name.startsWith(kw)) score += 30;
        } else if (storeName.includes(kw)) {
          matchCount++;
          score += 35;
        } else if (tags.includes(kw)) {
          matchCount++;
          score += 25;
        } else if (desc.includes(kw)) {
          matchCount++;
          score += 15;
        } else if (category.includes(kw)) {
          matchCount++;
          score += 10;
        }
      }

      // If at least one keyword matches (or all if 1-2 words)
      const minRequired = parsed.keywords.length <= 2 ? parsed.keywords.length : 1;
      if (matchCount >= minRequired) {
        scoredList.push({ product: p, score: score + matchCount * 20 });
      }
    }

    // Sort by search relevance score descending
    list = scoredList.sort((a, b) => b.score - a.score).map(s => s.product);
  }

  // 2. Category matching (only if explicitly set in parsed and yields results)
  if (parsed.category) {
    const catMatches = list.filter(p => p.category?.toLowerCase() === parsed.category?.toLowerCase());
    if (catMatches.length > 0) {
      list = catMatches;
    }
  }

  // 3. Price range matching (comparing against effective price, including discountPrice)
  if (parsed.maxPrice !== null) {
    list = list.filter(p => {
      const effectivePrice = p.discountPrice || p.price;
      return effectivePrice <= (parsed.maxPrice as number);
    });
  }
  if (parsed.minPrice !== null) {
    list = list.filter(p => {
      const effectivePrice = p.discountPrice || p.price;
      return effectivePrice >= (parsed.minPrice as number);
    });
  }

  // 4. Sort execution
  if (parsed.sortType === 'price_low') {
    list.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
  } else if (parsed.sortType === 'price_high') {
    list.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
  } else if (parsed.sortType === 'newest') {
    list.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }

  return list;
}
