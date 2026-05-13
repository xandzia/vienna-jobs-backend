import 'dotenv/config';
import { prisma } from '../db/prisma.js';
import { createEmbeddings } from '../ai/voyage.js';

const BATCH_SIZE = 50; // Voyage allows up to 128

interface JobForEmbedding {
    id: string;
    title: string;
    company: string;
    location: string;
}

/**
 * Build the text that goes into embedding.
 * For now: title + company + location (we don't have descriptions yet).
 * Future: include description for richer semantic matching.
 */
function buildEmbeddingText(job: JobForEmbedding): string {
    return `${job.title}. Company: ${job.company}. Location: ${job.location}.`;
}

async function main() {
    console.log('Starting embedding generation...\n');

    // 1. Find all jobs without embedding
    // Using raw SQL because Prisma doesn't support pgvector type directly
    const jobsWithoutEmbedding = await prisma.$queryRaw<JobForEmbedding[]>`
    SELECT id, title, company, location
    FROM jobs
    WHERE embedding IS NULL
  `;

    console.log(`Found ${jobsWithoutEmbedding.length} jobs without embeddings`);

    if (jobsWithoutEmbedding.length === 0) {
        console.log('Nothing to do.');
        await prisma.$disconnect();
        return;
    }

    // 2. Process in batches
    let processed = 0;
    const startTime = Date.now();

    for (let i = 0; i < jobsWithoutEmbedding.length; i += BATCH_SIZE) {
        const batch = jobsWithoutEmbedding.slice(i, i + BATCH_SIZE);
        const texts = batch.map(buildEmbeddingText);

        console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} jobs`);

        // 3. Get embeddings from Voyage (single batched API call)
        const embeddings = await createEmbeddings(texts);

        // 4. Save each embedding back to its job
        for (let j = 0; j < batch.length; j++) {
            const job = batch[j]!;
            const embedding = embeddings[j]!;

            // pgvector accepts vectors as string: '[0.1,0.2,0.3]'
            const vectorString = `[${embedding.join(',')}]`;

            await prisma.$executeRaw`
        UPDATE jobs
        SET embedding = ${vectorString}::vector
        WHERE id = ${job.id}
      `;

            processed++;
        }

        console.log(`  ✓ Embedded ${batch.length} jobs (${processed}/${jobsWithoutEmbedding.length} total)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Embedded ${processed} jobs in ${duration}s`);

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('Embedding failed:', err);
    await prisma.$disconnect();
    process.exit(1);
});