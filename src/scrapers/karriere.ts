import { chromium, type ElementHandle } from 'playwright';
import type { RawJob, JobSource } from './types.js';

const BASE_URL = 'https://www.karriere.at';
const SEARCH_URL = `${BASE_URL}/jobs/frontend-developer/wien`;

export class KarriereAtSource implements JobSource {
    name = 'karriere.at' as const;

    async scrape(): Promise<RawJob[]> {
        const browser = await chromium.launch({ headless: true });

        try {
            const page = await browser.newPage();
            console.log(`[${this.name}] Opening ${SEARCH_URL}`);

            await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.m-jobsListItem', { timeout: 10000 });

            const items = await page.$$('.m-jobsListItem');
            console.log(`[${this.name}] Found ${items.length} items, parsing...`);

            const jobs: RawJob[] = [];
            for (const item of items) {
                const job = await this.parseJobItem(item);
                if (job) jobs.push(job);
            }

            console.log(`[${this.name}] Extracted ${jobs.length} valid jobs`);
            return jobs;
        } finally {
            await browser.close();
        }
    }

    private async parseJobItem(
        item: ElementHandle<SVGElement | HTMLElement>
    ): Promise<RawJob | null> {
        // Helper to safely get text content of a child element
        const getText = async (selector: string): Promise<string | null> => {
            const el = await item.$(selector);
            if (!el) return null;
            const text = await el.textContent();
            return text?.trim() ?? null;
        };

        const externalId = await item.getAttribute('data-id');

        const titleLink = await item.$('.m-jobsListItem__titleLink');
        const title = await titleLink?.textContent();
        const url = await titleLink?.getAttribute('href');

        const company = await getText('.m-jobsListItem__companyName');
        const location = await getText('.m-jobsListItem__location');
        const postedAgo = await getText('.m-jobsListItem__date');

        // Find salary pill (contains €)
        const pills = await item.$$('.m-jobsListItem__pill');
        let salaryText: string | null = null;
        for (const pill of pills) {
            const text = await pill.textContent();
            if (text?.includes('€')) {
                salaryText = text.trim();
                break;
            }
        }

        const sponsoredLabel = await item.$('.m-jobsListItem__sponsoredLabel');
        const isSponsored = sponsoredLabel !== null;

        // Skip if required fields missing
        if (!externalId || !title || !url || !company || !location) {
            return null;
        }

        return {
            externalId,
            title: title.trim(),
            url,
            company,
            location,
            postedAgo,
            salaryText,
            isSponsored,
            source: 'karriere.at',
        };
    }
}