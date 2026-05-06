import 'dotenv/config';
import Fastify from 'fastify';
import { askClaude } from './ai/claude.js';

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

const PORT = Number(process.env.PORT) || 3000;

try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}