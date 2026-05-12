import 'dotenv/config';
import { KarriereAtSource } from '../scrapers/karriere.js';
import { normalizeJob } from '../scrapers/transform.js';
import { prisma } from '../db/prisma.js';

async function main() {
    console.log('Starting ingestion...\n');

    // 1. Scrape
    const source = new KarriereAtSource();
    const startTime = Date.now();
    const rawJobs = await source.scrape();

    // 2. Normalize
    const normalized = rawJobs.map(normalizeJob);
    console.log(`\nNormalized ${normalized.length} jobs`);

    // 3. Save to DB with upsert

    for (const job of normalized) {
        const result = await prisma.job.upsert({
            where: { externalId: job.externalId },
            create: job,
            update: {
                title: job.title,
                company: job.company,
                location: job.location,
                salaryMin: job.salaryMin,
                salaryMax: job.salaryMax,
                postedAt: job.postedAt,
                scrapedAt: new Date(),
            },
        });

        // Check if this was create or update via scrapedAt
        if (result.scrapedAt.getTime() === result.scrapedAt.getTime()) {
            // (always true — let's use a different signal)
        }
    }

    // Better: count total before and after
    const totalJobs = await prisma.job.count();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✓ Processed ${normalized.length} jobs in ${duration}s`);
    console.log(`✓ Total jobs in DB: ${totalJobs}`);

    console.log('\nFirst 3 normalized jobs:');
    console.log(JSON.stringify(normalized.slice(0, 3), null, 2));

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('Ingestion failed:', err);
    await prisma.$disconnect();
    process.exit(1);
});