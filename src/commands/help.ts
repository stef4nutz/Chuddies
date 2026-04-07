import { Command } from '../types/Command';
import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ComponentType, StringSelectMenuOptionBuilder } from 'discord.js';

const command: Command = {
    name: 'help',
    description: 'Displays a help menu with all available commands.',
    execute: async (message, args) => {
        const githubUrl = 'https://github.com/stef4nutz/Chuddies';

        const mainEmbed = new EmbedBuilder()
            .setTitle('🤖 Chuddie Bot Help')
            .setDescription(`Welcome to the help menu! Use the dropdown below to explore the command categories.\n\n🌟 **GitHub Repository:**\n[stef4nutz/Chuddies](${githubUrl})`)
            .setColor('#2b2d31')
            .setFooter({ text: 'Select a category from the dropdown below.' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Select a command category...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Main Page')
                    .setDescription('Return to the main help page')
                    .setValue('main')
                    .setEmoji('🏠'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Profile')
                    .setDescription('Manage your identity on the bot')
                    .setValue('profile')
                    .setEmoji('🥸'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Relationships')
                    .setDescription('Commands for marriages, family & e-sex')
                    .setValue('social')
                    .setEmoji('💖'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Looksmaxxing')
                    .setDescription('Commands for looksmaxxing. Only true maxxers are allowed in here.')
                    .setValue('looks')
                    .setEmoji('😎'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Utility & Fun')
                    .setDescription('Miscellaneous and fun commands')
                    .setValue('utility')
                    .setEmoji('🛠️')
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const helpMsg = await message.reply({ embeds: [mainEmbed], components: [row] });

        const collector = helpMsg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === message.author.id,
            time: 120000
        });

        collector.on('collect', async (interaction) => {
            const selected = interaction.values[0];
            let newEmbed = new EmbedBuilder().setColor('#2b2d31');

            if (selected === 'main') {
                newEmbed = mainEmbed;
            } else if (selected == 'profile') {
                newEmbed
                    .setTitle('🥸 Profile management')
                    .setDescription('Manage your identity on the bot.')
                    .addFields(
                        { name: '`$profile', value: 'View your own or others profiles.' },
                        { name: '`$profile edit', value: 'Change your current larp with a new one!' },
                        { name: '`$profile create', value: 'Create your profile, that\'s it.' },
                    );
            } else if (selected === 'social') {
                newEmbed
                    .setTitle('💖 Relationships')
                    .setDescription('Manage your relationships with others.')
                    .addFields(
                        { name: '`$marry @user`', value: 'Propose to another user.' },
                        { name: '`$divorce @user`', value: 'Break off a marriage.' },
                        { name: '`$kids`', value: 'Check on your beautiful children.' },
                        { name: '`$esex @user`', value: 'Initiate a spicy simulation with someone.\n**⚠️ If you are married, you will be shamed for engaging in lustful e-sex!**' }
                    );
            } else if (selected === 'looks') {
                newEmbed
                    .setTitle('😎 Looksmaxxing')
                    .setDescription('Compete for XP by voting on looks.')
                    .addFields(
                        { name: '`$looks setup`', value: 'Setup the looksmaxxing channels for the server.' },
                        { name: '`$participate`', value: 'Submit an image to the looksboard voting.' },
                        { name: '`$looksboard`', value: 'View the top 10 users ranked by XP.' }
                    );
            } else if (selected === 'utility') {
                newEmbed
                    .setTitle('🛠️ Utility & Fun')
                    .setDescription('Other tools and gimmicks.')
                    .addFields(
                        { name: '`$ping`', value: 'Check the bot latency.' },
                        { name: '`$ip @user`', value: 'Run a hacking simulation to find someone\'s IP.' }
                    );
            }

            await interaction.update({ embeds: [newEmbed] });
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    selectMenu.setDisabled(true)
                );
                helpMsg.edit({ components: [disabledRow] }).catch(() => { });
            }
        });
    }
};

export default command;
