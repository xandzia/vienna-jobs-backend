import { prisma } from '../db/prisma.js';
import { createEmbedding } from './voyage.js';

export interface JobMatch {
    id: string;
    externalId: string;
    title: string;
    company: string;
    location: string;
    url: string;
    salaryMin: number | null;
    salaryMax: number | null;
    similarity: number;
}

/**
 * Vector similarity search.
 * Returns top-K jobs most similar to the query.
 */
export async function searchJobs(
    query: string,
    limit: number = 20
): Promise<JobMatch[]> {
    // 1. Embed the query (with 'query' input_type for asymmetric embeddings)
    const queryEmbedding = await createEmbedding(query, 'query');
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 2. Vector similarity search via pgvector
    const results = await prisma.$queryRaw<JobMatch[]>`
    SELECT 
      id,
      "externalId",
      title,
      company,
      location,
      url,
      "salaryMin",
      "salaryMax",
      ROUND((1 - (embedding <=> ${vectorString}::vector))::numeric, 4)::float as similarity
    FROM jobs
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;

    return results;
}
