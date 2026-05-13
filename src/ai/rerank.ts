import { anthropic } from './claude.js';
import type { JobMatch } from './retrieval.js';

export interface RankedJob {
    job: JobMatch;
    reasoning: string;
    rank: number;
}

interface ClaudeRerankResponse {
    ranked_jobs: Array<{
        id: string;
        rank: number;
        reasoning: string;
    }>;
    query_interpretation: string;
}

/**
 * Re-rank jobs using Claude with reasoning.
 * Takes top-K from vector search, returns smaller set ranked by semantic fit.
 */
export async function rerankJobs(
    query: string,
    jobs: JobMatch[],
    topK: number = 5
): Promise<{ ranked: RankedJob[]; queryInterpretation: string }> {
    if (jobs.length === 0) {
        return { ranked: [], queryInterpretation: '' };
    }

    // Build compact job list for the prompt
    const jobsForPrompt = jobs
        .map(
            (j, idx) =>
                `${idx + 1}. [ID: ${j.id}] "${j.title}" at ${j.company} (${j.location})` +
                (j.salaryMin ? `, salary ${j.salaryMin}€+` : '')
        )
        .join('\n');

    const systemPrompt = `You are an expert tech recruiter helping a developer find the best job matches.

You will receive a user's job search query and a list of candidate jobs (already pre-filtered by semantic search).

Your task:
1. Understand what the user is REALLY looking for (seniority, tech stack, focus areas)
2. Re-rank the top ${topK} jobs that best match — considering nuances the vector search might have missed
3. For each, write a brief 1-sentence reasoning explaining WHY it matches

Be strict: only include truly relevant matches. If only 3 jobs really fit, return 3.

Return STRICT JSON in this format:
{
  "query_interpretation": "Brief description of what the user wants",
  "ranked_jobs": [
    {"id": "job_id_here", "rank": 1, "reasoning": "Why this fits"},
    ...
  ]
}`;

    const userPrompt = `User query: "${query}"

Candidate jobs:
${jobsForPrompt}

Return top ${topK} most relevant as strict JSON.`;

    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== 'text') {
        throw new Error('Unexpected Claude response format');
    }

    // Extract JSON from response (Claude sometimes wraps in markdown)
    const text = firstBlock.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error(`Could not find JSON in Claude response: ${text}`);
    }

    const parsed = JSON.parse(jsonMatch[0]) as ClaudeRerankResponse;

    // Map Claude's ranking back to actual job objects
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const ranked: RankedJob[] = parsed.ranked_jobs
        .map((r) => {
            const job = jobById.get(r.id);
            if (!job) return null;
            return { job, rank: r.rank, reasoning: r.reasoning };
        })
        .filter((r): r is RankedJob => r !== null)
        .sort((a, b) => a.rank - b.rank);

    return {
        ranked,
        queryInterpretation: parsed.query_interpretation,
    };
}
