import { Command } from '../types/Command';
import { EmbedBuilder } from 'discord.js';
import User from '../database/models/User';

const command: Command = {
    name: 'looksboard',
    description: 'Displays the top 10 looksmaxxers.',
    execute: async (message, args) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server.');
            return;
        }

        try {
            // Find top 10 users by XP per specific Server
            const topUsers = await User.find({ guildId: message.guild.id }).sort({ xp: -1 }).limit(10);

            if (!topUsers || topUsers.length === 0) {
                await message.reply('No one is on the looksboard yet!');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🏆 Top 10 Looksmaxxers')
                .setColor('#ffd700')
                .setThumbnail(message.client.user?.displayAvatarURL() || null);

            let description = '';
            for (let i = 0; i < topUsers.length; i++) {
                const p = topUsers[i];
                // Try fetching the discord user to display their tag, default to Unknown
                let displayStr = `User: <@${p.discordId}>`;
                
                description += `**#${i + 1}** | ${displayStr} - **${p.xp} XP**\n`;
            }

            embed.setDescription(description);

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching looksboard:', error);
            await message.reply('There was an error trying to fetch the leaderboard.');
        }
    }
};

export default command;
