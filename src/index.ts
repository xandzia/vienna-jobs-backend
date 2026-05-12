import 'dotenv/config';
import Fastify from 'fastify';
import { askClaude } from './ai/claude.js';
import { prisma } from './db/prisma.js';

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

const PORT = Number(process.env.PORT) || 3000;

try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}