import { Command } from '../../types/Command';
import { EmbedBuilder } from 'discord.js';
import Kid from '../../database/models/Kid';

function getSchoolStage(age: number): string {
    if (age < 3) return '👶 Infant';
    if (age <= 5) return '🎨 Preschool';
    if (age <= 11) return '📚 Elementary';
    if (age <= 14) return '🏫 Middle School';
    if (age <= 18) return '🎒 High School';
    if (age <= 22) return '🎓 College';
    return '🏆 Graduated';
}

function getHeartsDisplay(hearts: number): string {
    return '❤️'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, 10 - hearts));
}

const command: Command = {
    name: 'kids',
    description: 'View all your children.',
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
            .setTitle(`👨‍👩‍👧‍👦 ${target.username}'s Children`)
            .setColor('#add8e6')
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: 'Use $kid <name> to view and interact with a specific child.' });

        const kidsList = await Promise.all(kids.map(async (k) => {
            const otherParentId = k.motherId === target.id ? k.fatherId : k.motherId;
            const otherParent = await message.client.users.fetch(otherParentId).catch(() => null);
            const otherParentName = otherParent ? otherParent.username : 'Unknown';
            const genderRole = k.motherId === target.id ? 'Mother' : 'Father';
            const icon = k.isAlive ? (k.gender === 'girl' ? '👧' : '👦') : '💀';
            const statusText = k.isAlive ? `${getSchoolStage(k.age)} | Age ${k.age}` : 'Deceased';
            const hearts = k.isAlive ? getHeartsDisplay(k.hearts) : '💀';

            return `${icon} **${k.name}** — ${statusText}\n  └ ${hearts}\n  └ Parents: ${target.username} & ${otherParentName}`;
        }));

        // Split into pages of 5
        const pageSize = 5;
        const page = kidsList.slice(0, pageSize);
        embed.setDescription(page.join('\n\n'));
        if (kids.length > pageSize) {
            embed.addFields({ name: '​', value: `*...and ${kids.length - pageSize} more. (Showing first ${pageSize})*` });
        }

        await message.reply({ embeds: [embed] });
    }
};

export default command;
