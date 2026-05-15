import { Bot, type Context } from 'grammy';
import { prisma } from '../db/prisma.js';
import { searchJobs } from '../ai/retrieval.js';
import { rerankJobs } from '../ai/rerank.js';

if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// ─── Helper: get or create user by Telegram chat ID ───────────────
async function getOrCreateUser(ctx: Context) {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) throw new Error('No chat ID');

    const name = ctx.from?.first_name ?? null;

    const user = await prisma.user.upsert({
        where: { telegramChatId: chatId },
        create: { telegramChatId: chatId, name },
        update: { name }, // update name in case it changed
    });

    return user;
}

// ─── /start command ───────────────────────────────────────────────
bot.command('start', async (ctx) => {
    const user = await getOrCreateUser(ctx);

    await ctx.reply(
        `Hi ${user.name ?? 'there'}! 👋\n\n` +
        `I'm your AI-powered job hunter for frontend roles in Vienna.\n\n` +
        `Try:\n` +
        `/find senior react with TypeScript\n` +
        `/find junior frontend role\n` +
        `/help — see all commands`
    );
});

// ─── /help command ────────────────────────────────────────────────
bot.command('help', async (ctx) => {
    await ctx.reply(
        `📚 Available commands:\n\n` +
        `/find <query> — search jobs using AI\n` +
        `/start — register and see welcome message\n` +
        `/help — this message\n\n` +
        `Example queries:\n` +
        `• /find senior react developer\n` +
        `• /find frontend with focus on performance\n` +
        `• /find vue developer in vienna`
    );
});

// ─── /find command — main RAG search ──────────────────────────────
bot.command('find', async (ctx) => {
    // Get user (auto-register if first time)
    await getOrCreateUser(ctx);

    // Extract query text after /find
    const query = ctx.match?.trim();

    if (!query) {
        await ctx.reply(
            '❓ Please add a query after /find\n\n' +
            'Example:\n' +
            '/find senior react developer with TypeScript'
        );
        return;
    }

    // Show "thinking" indicator
    await ctx.replyWithChatAction('typing');
    const statusMessage = await ctx.reply('🔍 Searching jobs...');

    try {
        // Step 1: Vector retrieval
        const candidates = await searchJobs(query, 20);

        if (candidates.length === 0) {
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMessage.message_id,
                '😕 No jobs found. The database might be empty — try /find later.'
            );
            return;
        }

        // Step 2: Claude re-ranking
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMessage.message_id,
            '🤖 Analyzing with AI...'
        );

        const { ranked, queryInterpretation } = await rerankJobs(query, candidates, 3);

        // Step 3: Delete status message, send results
        await ctx.api.deleteMessage(ctx.chat.id, statusMessage.message_id);

        await ctx.reply(
            `🎯 *Understood:* ${queryInterpretation}\n\n` +
            `Found *${ranked.length}* matches:`,
            { parse_mode: 'Markdown' }
        );

        // Send each job as separate message
        for (const item of ranked) {
            const j = item.job;
            const salaryLine = j.salaryMin
                ? `💰 ${j.salaryMin.toLocaleString()}€${j.salaryMax ? `–${j.salaryMax.toLocaleString()}€` : '+'}`
                : '';

            const text =
                `*${escapeMd(j.title)}*\n` +
                `🏢 ${escapeMd(j.company)} · 📍 ${escapeMd(j.location)}\n` +
                (salaryLine ? `${salaryLine}\n` : '') +
                `\n_${escapeMd(item.reasoning)}_`;

            await ctx.reply(text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔗 View', url: j.url },
                            { text: '⭐ Save', callback_data: `save:${j.id}` },
                        ],
                        [
                            { text: '✅ Applied', callback_data: `applied:${j.id}` },
                            { text: '❌ Skip', callback_data: `skip:${j.id}` },
                        ],
                    ],
                },
            });
        }
    } catch (err) {
        console.error('Find command failed:', err);
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMessage.message_id,
            '⚠️ Something went wrong. Please try again later.'
        );
    }
});

// Escape special Markdown characters for safe rendering
function escapeMd(text: string): string {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

// ─── Callback button handlers ─────────────────────────────────────
// Map button action → ApplicationStatus enum value
const ACTION_TO_STATUS = {
    save: 'SAVED',
    applied: 'APPLIED',
    skip: 'REJECTED',
} as const;

const ACTION_LABELS = {
    save: '⭐ Saved',
    applied: '✅ Applied',
    skip: '❌ Skipped',
} as const;

bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [action, jobId] = data.split(':');

    if (!action || !jobId || !(action in ACTION_TO_STATUS)) {
        await ctx.answerCallbackQuery({ text: 'Unknown action' });
        return;
    }

    const typedAction = action as keyof typeof ACTION_TO_STATUS;
    const status = ACTION_TO_STATUS[typedAction];

    try {
        // Get current user
        const user = await getOrCreateUser(ctx);

        // Verify job exists
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) {
            await ctx.answerCallbackQuery({ text: 'Job not found' });
            return;
        }

        // Upsert application — one record per (user, job) thanks to composite unique
        await prisma.application.upsert({
            where: {
                userId_jobId: { userId: user.id, jobId: jobId },
            },
            create: {
                userId: user.id,
                jobId: jobId,
                status: status,
            },
            update: {
                status: status,
            },
        });

        // Small popup confirmation (top of screen)
        await ctx.answerCallbackQuery({
            text: `${ACTION_LABELS[typedAction]} — saved to your list`,
        });

        // Replace inline keyboard to show selected action
        await ctx.editMessageReplyMarkup({
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔗 View', url: job.url },
                        { text: ACTION_LABELS[typedAction], callback_data: 'noop' },
                    ],
                ],
            },
        });
    } catch (err) {
        console.error('Callback failed:', err);
        await ctx.answerCallbackQuery({ text: '⚠️ Something went wrong' });
    }
});

// ─── Error handler ────────────────────────────────────────────────
bot.catch((err) => {
    console.error('Bot error:', err);
});

console.log('Telegram bot configured');
