import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env');
}

export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askClaude(prompt: string): Promise<string> {
    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: prompt,
            },
        ],
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
    }

    return firstBlock.text;
}