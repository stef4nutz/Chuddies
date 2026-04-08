import { Command } from '../types/Command';
import User from '../database/models/User';

const command: Command = {
    name: 'work',
    description: 'Work for some Chudbucks.',
    execute: async (message, args) => {
        const userId = message.author.id;
        const guildId = message.guild?.id;

        if (!guildId) return;

        let userRecord = await User.findOne({ discordId: userId, guildId: guildId });

        if (!userRecord) {
            userRecord = new User({ discordId: userId, guildId: guildId, balance: 0, job: 'Unemployed' });
        }

        // Check cooldown (10 seconds)
        const now = new Date();
        const lastWork = userRecord.lastWork;
        if (lastWork && (now.getTime() - lastWork.getTime()) < 10000) {
            const timeLeft = Math.ceil((10000 - (now.getTime() - lastWork.getTime())) / 1000);
            return message.reply(`Too fast! Wait **${timeLeft}s** to work again.`);
        }

        let payout = 0;
        let job = userRecord.job || 'Unemployed';

        switch (job) {
            case 'Wagie':
                payout = 500 + Math.floor(Math.random() * 501);
                break;
            case 'CEO':
                payout = 50000 + Math.floor(Math.random() * 50001);
                break;
            case 'Discord Mod':
                payout = 1000 + Math.floor(Math.random() * 9001);
                break;
            case 'Streamer':
                payout = 5000 + Math.floor(Math.random() * 45001);
                break;
            case 'NEET':
                payout = Math.random() < 0.1 ? 50 : 0; // 10% chance to find 50 Chudbucks
                break;
            default:
                payout = 10 + Math.floor(Math.random() * 41);
                break;
        }

        userRecord.balance += payout;
        userRecord.lastWork = now;
        await userRecord.save();

        if (job === 'NEET' && payout === 0) {
            return message.reply("You sat on your couch and did nothing. No pay! (Typical NEET behavior)");
        } else if (job === 'NEET' && payout > 0) {
            return message.reply("You looked under your couch and found **5 <:chudbucks:1491251114157277314> Chudbucks**! You're moving up!");
        }

        return message.reply(`Work shift complete! You earned **${payout} <:chudbucks:1491251114157277314> Chudbucks** as a **${job}**!`);
    }
};

export default command;
