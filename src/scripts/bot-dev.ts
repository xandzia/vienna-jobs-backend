import 'dotenv/config';
import { bot } from '../bot/bot.js';

console.log('Starting bot in polling mode...');
console.log('Press Ctrl+C to stop\n');

// Start long-polling
bot.start({
    onStart: (info) => {
        console.log(`Bot @${info.username} is running`);
        console.log(`Find it: https://t.me/${info.username}`);
    },
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
