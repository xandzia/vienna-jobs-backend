// Common types for all scrapers

export interface RawJob {
    externalId: string;
    title: string;
    url: string;
    company: string;
    location: string;
    postedAgo: string | null; // "vor 5 Tagen veröffentlicht"
    salaryText: string | null; // "ab 3.300 € monatlich"
    isSponsored: boolean;
    source: 'karriere.at';
}

// Future: when we add more sources, they all return RawJob
export interface JobSource {
    name: string;
    scrape(): Promise<RawJob[]>;
}