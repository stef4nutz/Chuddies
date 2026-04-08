import { Command } from '../types/Command';
import User from '../database/models/User';
import { EmbedBuilder } from 'discord.js';

const jobs = [
    { name: 'NEET', pay: '0', description: 'Be a shut-in, no pay.', levelRequired: 1 },
    { name: 'Wagie', pay: '500-1,000', description: 'Flip burgers for low pay.', levelRequired: 1 },
    { name: 'Discord Mod', pay: '1,000-10,000', description: 'Ban people for free (sometimes get a tip).', levelRequired: 3 },
    { name: 'Streamer', pay: '5,000-50,000', description: 'Entertain your fans for bits.', levelRequired: 5 },
    { name: 'CEO', pay: '50,000-100,000', description: 'Manage a corporation for big bucks.', levelRequired: 10 }
];

const command: Command = {
    name: 'job',
    description: 'Manage your job and see available professions.',
    execute: async (message, args) => {
        const subCommand = args[0]?.toLowerCase();
        const guildId = message.guild?.id;

        if (subCommand === 'list') {
            const embed = new EmbedBuilder()
                .setTitle('Available Jobs')
                .setDescription('Use `$job join <jobname>` to apply!')
                .setColor('#00ffbb');

            jobs.forEach(job => {
                embed.addFields({ name: `${job.name} (Req. Lvl: ${job.levelRequired})`, value: `${job.description}\nPay: ${job.pay}` });
            });

            return message.reply({ embeds: [embed] });
        }

        if (subCommand === 'join') {
            const jobName = args.slice(1).join(' ').toLowerCase();
            const jobFound = jobs.find(j => j.name.toLowerCase() === jobName);

            if (!jobFound) {
                return message.reply('That job does not exist! Check `$job list` for available roles.');
            }

            let userRecord = await User.findOne({ discordId: message.author.id, guildId: guildId });

            const currentLevel = userRecord?.level || 1;
            if (currentLevel < jobFound.levelRequired) {
                return message.reply(`You need to be **Level ${jobFound.levelRequired}** to join the **${jobFound.name}** workforce! You are currently Level ${currentLevel}.`);
            }

            await User.findOneAndUpdate(
                { discordId: message.author.id, guildId: guildId },
                { job: jobFound.name },
                { upsert: true }
            );

            return message.reply(`Congrats! You've joined the **${jobFound.name}** workforce!`);
        }

        return message.reply('Usage: `$job list` or `$job join <jobname>`');
    }
};

export default command;
