import { Command } from '../types/Command';
import { EmbedBuilder } from 'discord.js';
import Kid from '../database/models/Kid';

const command: Command = {
    name: 'kids',
    description: 'View your children.',
    execute: async (message, args) => {
        const target = message.mentions.users.first() || message.author;
        const kids = await Kid.find({
            guildId: message.guildId,
            $or: [
                { motherId: target.id },
                { fatherId: target.id }
            ]
        }).sort({ createdAt: -1 });

        if (kids.length === 0) {
            return message.reply(`${target.username} has no children.`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`👶 ${target.username}'s Children`)
            .setColor('#add8e6')
            .setThumbnail(target.displayAvatarURL());

        const kidsList = await Promise.all(kids.map(async (k) => {
            const otherParentId = k.motherId === target.id ? k.fatherId : k.motherId;
            const otherParent = await message.client.users.fetch(otherParentId).catch(() => null);
            const otherParentName = otherParent ? otherParent.username : 'Unknown';
            const genderRole = k.motherId === target.id ? 'Mother' : 'Father';
            
            return `• **${k.name}**\n  └ Parents: ${target.username} (${genderRole}) & ${otherParentName}`;
        }));

        embed.setDescription(kidsList.join('\n\n'));

        await message.reply({ embeds: [embed] });
    }
};

export default command;
