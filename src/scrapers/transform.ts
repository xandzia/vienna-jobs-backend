import type { RawJob } from './types.js';

export interface NormalizedJob {
    externalId: string;
    title: string;
    url: string;
    company: string;
    location: string;
    description: string;
    salaryMin: number | null;
    salaryMax: number | null;
    postedAt: Date | null;
}

/**
 * Parse salary text from karriere.at into min/max numbers (annual EUR).
 *
 * Examples:
 *   "ab 3.300 € monatlich"        -> { min: 46200, max: null }
 *   "3.900 € – 5.000 € monatlich" -> { min: 54600, max: 70000 }
 *   "Vollzeit"                    -> { min: null, max: null }
 */
export function parseSalary(text: string | null): {
    min: number | null;
    max: number | null;
} {
    if (!text) return { min: null, max: null };

    // Extract all numbers like "3.300" or "5.000"
    const numbers = text.match(/(\d{1,3}(?:\.\d{3})+|\d+)/g);
    if (!numbers || numbers.length === 0) return { min: null, max: null };

    // Convert "3.300" → 3300 (German uses . as thousand separator)
    const parsed = numbers.map((n) => parseInt(n.replace(/\./g, ''), 10));

    const isMonthly = text.toLowerCase().includes('monatlich');
    const multiplier = isMonthly ? 14 : 1; // Austria has 14 salaries/year

    if (parsed.length === 1) {
        return { min: parsed[0]! * multiplier, max: null };
    }
    return { min: parsed[0]! * multiplier, max: parsed[1]! * multiplier };
}

/**
 * Parse relative German date to absolute Date.
 *
 * Examples:
 *   "Heute veröffentlicht"      -> today
 *   "Gestern veröffentlicht"    -> yesterday
 *   "vor 5 Tagen veröffentlicht" -> 5 days ago
 */
export function parseDate(text: string | null): Date | null {
    if (!text) return null;

    const lower = text.toLowerCase();
    const now = new Date();

    if (lower.includes('heute')) {
        return now;
    }

    if (lower.includes('gestern')) {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return d;
    }

    // "vor X Tagen" → X days ago
    const daysMatch = lower.match(/vor\s+(\d+)\s+tag/);
    if (daysMatch?.[1]) {
        const days = parseInt(daysMatch[1], 10);
        const d = new Date(now);
        d.setDate(d.getDate() - days);
        return d;
    }

    return null;
}

/**
 * Clean location: "Wien 2. Bezirk (Leopoldstadt)" -> "Vienna"
 */
export function normalizeLocation(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes('wien')) return 'Vienna';
    if (lower.includes('graz')) return 'Graz';
    if (lower.includes('linz')) return 'Linz';
    if (lower.includes('salzburg')) return 'Salzburg';
    return raw; // keep original for other cities
}

/**
 * Transform raw scraped data into structured form for DB.
 * Description is empty for now — we'll fetch detail pages later.
 */
export function normalizeJob(raw: RawJob): NormalizedJob {
    const { min, max } = parseSalary(raw.salaryText);

    return {
        externalId: raw.externalId,
        title: raw.title,
        url: raw.url,
        company: raw.company,
        location: normalizeLocation(raw.location),
        description: '', // TODO: fetch from detail page
        salaryMin: min,
        salaryMax: max,
        postedAt: parseDate(raw.postedAgo),
    };
}