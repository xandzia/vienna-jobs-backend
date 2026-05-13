const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-3';

if (!process.env.VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY is not set in .env');
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

type InputType = 'document' | 'query';

interface VoyageEmbeddingResponse {
    data: Array<{
        embedding: number[];
        index: number;
    }>;
    model: string;
    usage: {
        total_tokens: number;
    };
}

export async function createEmbedding(
    text: string,
    inputType: InputType = 'document'
): Promise<number[]> {
    const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${VOYAGE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            input: text,
            model: EMBEDDING_MODEL,
            input_type: inputType,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as VoyageEmbeddingResponse;
    const firstResult = data.data[0];

    if (!firstResult) {
        throw new Error('Voyage returned empty embeddings array');
    }

    return firstResult.embedding;
}

export async function createEmbeddings(
    texts: string[],
    inputType: InputType = 'document'
): Promise<number[][]> {
    const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${VOYAGE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            input: texts,
            model: EMBEDDING_MODEL,
            input_type: inputType,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as VoyageEmbeddingResponse;
    return data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
}