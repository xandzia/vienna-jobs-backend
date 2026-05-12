import 'dotenv/config';
import { KarriereAtSource } from '../scrapers/karriere.js';

async function main() {
    console.log('Starting ingestion...\n');

    const source = new KarriereAtSource();
    const startTime = Date.now();

    const rawJobs = await source.scrape();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Scraped ${rawJobs.length} jobs in ${duration}s`);
    console.log('\nFirst 3 jobs:');
    console.log(JSON.stringify(rawJobs.slice(0, 3), null, 2));
}

main().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});