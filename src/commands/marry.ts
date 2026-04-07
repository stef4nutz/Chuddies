import { Command } from '../types/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import User from '../database/models/User';

const command: Command = {
    name: 'marry',
    description: 'Propose to another user.',
    execute: async (message, args) => {
        const target = message.mentions.users.first();

        if (!target) {
            return message.reply('You must mention someone to marry!');
        }

        if (target.id === message.author.id) {
            return message.reply('You cannot marry yourself!');
        }

        if (target.bot) {
            return message.reply('You cannot marry bots!');
        }

        // Check if either user is already married
        const proposerData = await User.findOne({ discordId: message.author.id, guildId: message.guildId });
        const targetData = await User.findOne({ discordId: target.id, guildId: message.guildId });

        if (proposerData?.spouseId) {
            return message.reply('You are already married! You must divorce first.');
        }

        if (!proposerData || (!proposerData.age && !proposerData.description)) {
            return message.reply('You must create a profile first with `$profile create`!');
        }

        if (targetData?.spouseId) {
            return message.reply(`${target.username} is already married!`);
        }

        if (!targetData || (!targetData.age && !targetData.description)) {
            return message.reply(`${target.username} hasn't created a profile yet! They must use \`$profile create\` first.`);
        }

        // Determine marriage type based on genders
        let marriageType = 'Marriage';
        const pGender = proposerData?.gender || 'Moid';
        const tGender = targetData?.gender || 'Moid';

        if (pGender === 'Troid' || tGender === 'Troid') {
            marriageType = 'Trans Marriage';
        } else if (pGender === 'Moid' && tGender === 'Moid') {
            marriageType = 'Gay Marriage';
        } else if (pGender === 'Foid' && tGender === 'Foid') {
            marriageType = 'Lesbian Marriage';
        }

        const embed = new EmbedBuilder()
            .setTitle(`💍 ${marriageType} Proposal`)
            .setDescription(`${target}, ${message.author.username} has proposed to you! Do you accept?`)
            .setColor('#ff69b4')
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('marry_accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('marry_decline')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const proposalMsg = await message.reply({
            content: `${target}`,
            embeds: [embed],
            components: [row]
        });

        const collector = proposalMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === target.id,
            time: 60000 // 1 minute
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'marry_accept') {
                // Double check marriage status at the moment of acceptance
                const latestTargetData = await User.findOne({ discordId: target.id, guildId: message.guildId });
                const latestProposerData = await User.findOne({ discordId: message.author.id, guildId: message.guildId });

                if (latestTargetData?.spouseId || latestProposerData?.spouseId) {
                    await interaction.reply({ content: 'One of you has already married someone else!', ephemeral: true });
                    collector.stop('already_married');
                    return;
                }

                // Update database
                await User.findOneAndUpdate(
                    { discordId: message.author.id, guildId: message.guild?.id },
                    { $set: { spouseId: target.id } },
                    { upsert: true }
                );
                await User.findOneAndUpdate(
                    { discordId: target.id, guildId: message.guild?.id },
                    { $set: { spouseId: message.author.id } },
                    { upsert: true }
                );

                await interaction.update({
                    content: `🎉 **CONGRATULATIONS!** ${message.author} and ${target} are now joined in **${marriageType}**! 🥂`,
                    embeds: [],
                    components: []
                });
                collector.stop('accepted');
            } else {
                await interaction.update({
                    content: `💔 ${message.author.username}, ${target.username} declined your proposal.`,
                    embeds: [],
                    components: []
                });
                collector.stop('declined');
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await proposalMsg.edit({
                    content: `⏰ The proposal to ${target.username} has timed out.`,
                    embeds: [],
                    components: []
                }).catch(() => {});
            }
        });
    }
};

export default command;
