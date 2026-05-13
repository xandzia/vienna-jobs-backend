import 'dotenv/config';
import Fastify from 'fastify';
import { askClaude } from './ai/claude.js';
import { prisma } from './db/prisma.js';
import { createEmbedding } from './ai/voyage.js';
import { searchJobs } from './ai/retrieval.js';
import { rerankJobs } from './ai/rerank.js';

interface SearchBody {
    query: string;
    topK?: number;
}

const fastify = Fastify({
    logger: true,
});

fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/test-claude', async () => {
    const answer = await askClaude(
        'Say hello in exactly 5 words. Be friendly.'
    );
    return { answer };
});

fastify.get('/test-db', async () => {
    // Create a test job
    const job = await prisma.job.create({
        data: {
            externalId: `test-${Date.now()}`,
            title: 'Senior React Developer',
            company: 'Bitpanda',
            location: 'Vienna',
            description: 'We are looking for an experienced React developer...',
            url: 'https://karriere.at/jobs/test',
            salaryMin: 65000,
            salaryMax: 85000,
        },
    });

    // Get total count
    const totalJobs = await prisma.job.count();

    return {
        created: job,
        totalJobs,
    };
});

fastify.get('/test-voyage', async () => {
    const embedding = await createEmbedding(
        'Senior React Developer with TypeScript experience'
    );

    return {
        dimensions: embedding.length,
        first5: embedding.slice(0, 5),
        last5: embedding.slice(-5),
    };
});

interface SearchBody {
    query: string;
    limit?: number;
}

fastify.post<{ Body: SearchBody }>('/api/search', async (request, reply) => {
    const { query, topK } = request.body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return reply.status(400).send({ error: 'Query is required' });
    }

    // Step 1: Vector retrieval — get top-20 candidates
    const candidates = await searchJobs(query, 20);

    // Step 2: Claude re-ranking → top-K with reasoning
    const { ranked, queryInterpretation } = await rerankJobs(
        query,
        candidates,
        topK ?? 5
    );

    return {
        query,
        queryInterpretation,
        total: ranked.length,
        results: ranked.map((r) => ({
            rank: r.rank,
            reasoning: r.reasoning,
            job: r.job,
        })),
    };
});

const PORT = Number(process.env.PORT) || 3000;

try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}