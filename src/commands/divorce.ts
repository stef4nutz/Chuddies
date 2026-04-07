import { Command } from '../types/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import User from '../database/models/User';

const command: Command = {
    name: 'divorce',
    description: 'End your marriage.',
    execute: async (message) => {
        const userData = await User.findOne({ discordId: message.author.id, guildId: message.guildId });

        if (!userData || !userData.spouseId) {
            return message.reply('You are not married!');
        }

        const spouseId = userData.spouseId;
        const spouse = await message.client.users.fetch(spouseId).catch(() => null);
        const spouseName = spouse ? spouse.username : 'your spouse';

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('divorce_yes')
                .setLabel('Yes, Divorce')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('divorce_no')
                .setLabel('No, Stay Married')
                .setStyle(ButtonStyle.Secondary)
        );

        const confirmMsg = await message.reply({
            content: `❓ Are you sure you want to divorce **${spouseName}**?`,
            components: [row]
        });

        const collector = confirmMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === message.author.id,
            time: 30000 // 30 seconds
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'divorce_yes') {
                // Clear spouse for both users
                await User.findOneAndUpdate(
                    { discordId: message.author.id, guildId: message.guildId },
                    { $set: { spouseId: null } }
                );
                await User.findOneAndUpdate(
                    { discordId: spouseId, guildId: message.guildId },
                    { $set: { spouseId: null } }
                );

                await interaction.update({
                    content: `💔 You have divorced **${spouseName}**.`,
                    components: []
                });
                collector.stop('divorced');
            } else {
                await interaction.update({
                    content: 'Marriage preserved. Try to work things out!',
                    components: []
                });
                collector.stop('cancelled');
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await confirmMsg.edit({
                    content: '⏰ Divorce request timed out.',
                    components: []
                }).catch(() => {});
            }
        });
    }
};

export default command;
