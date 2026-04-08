import { Command } from '../types/Command';
import User from '../database/models/User';
import { EmbedBuilder } from 'discord.js';

const command: Command = {
    name: 'balance',
    description: 'Check your current amount of Chudbucks.',
    execute: async (message, args) => {
        const guildId = message.guild?.id;
        if (!guildId) return;

        // Check for mentoning another user
        const target = message.mentions.users.first() || message.author;
        const targetId = target.id;

        const userRecord = await User.findOne({ discordId: targetId, guildId: guildId });

        if (!userRecord) {
            return message.reply(`**${target.username}** currently has **0 <:chudbucks:1491251114157277314> Chudbucks** and is unemployed.`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${target.username}'s Wallet`)
            .addFields(
                { name: 'Balance', value: `<:chudbucks:1491251114157277314> **${userRecord.balance || 0} Chudbucks**`, inline: true },
                { name: 'Profession', value: `💼 **${userRecord.job || 'Unemployed'}**`, inline: true }
            )
            .setThumbnail(target.displayAvatarURL())
            .setColor('#2ecc71');

        return message.reply({ embeds: [embed] });
    }
};

export default command;
