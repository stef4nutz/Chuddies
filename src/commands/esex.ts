import { Command } from '../types/Command';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import User from '../database/models/User';
import Kid from '../database/models/Kid';

const command: Command = {
    name: 'esex',
    description: 'A consensual interactive simulation.',
    execute: async (message, args) => {
        const target = message.mentions.users.first();

        if (!target) {
            return message.reply('You must mention someone to esex!');
        }

        if (target.id === message.author.id) {
            return message.reply('You cannot esex yourself!');
        }

        if (target.bot) {
            return message.reply('Bots cannot participate in esex!');
        }

        // Fetch user data for both
        const authorData = await User.findOne({ discordId: message.author.id, guildId: message.guildId });
        const targetData = await User.findOne({ discordId: target.id, guildId: message.guildId });

        // Check if both have profiles
        if (!authorData || (!authorData.age && !authorData.description)) {
            return message.reply('You must create a profile first with `$profile create`!');
        }

        if (!targetData || (!targetData.age && !targetData.description)) {
            return message.reply(`${target.username} hasn't created a profile yet!`);
        }

        // Loyalty/Shame Logic
        let cheatingPrefix = '';
        if (authorData.spouseId && authorData.spouseId !== target.id) {
            cheatingPrefix += `🔔 **FORSHAME!** <@${authorData.spouseId}> is being CUCKED by ${message.author} with ${target}!\n`;
        }

        const isMarried = authorData.spouseId === target.id;
        const title = isMarried ? '💒 Married E-sex' : '🔞 LUST ESEX';
        const embedImage = isMarried ? 'https://i.imgur.com/ZZjLl2G.png' : 'https://i.imgur.com/pfhiSPi.png';

        // 1. Proposal
        const proposalEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`${target}, ${message.author.username} wants to esex with you. Do you consent?`)
            .setColor('#ff69b4')
            .setThumbnail(embedImage);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('esex_accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('esex_decline')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        const proposalMsg = await message.reply({
            content: cheatingPrefix ? cheatingPrefix : `${target}`,
            embeds: [proposalEmbed],
            components: [row]
        });

        const collector = proposalMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === target.id,
            time: 60000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'esex_decline') {
                await interaction.update({ content: `❌ ${target.username} declined. No session today.`, embeds: [], components: [] });
                return collector.stop();
            }

            // Start Simulation
            const simActions = [
                { id: 'act_kiss', label: '💋 Kiss' },
                { id: 'act_touch', label: '✋ Touch' },
                { id: 'act_stroke', label: '🍆 Stroke' },
                { id: 'act_suck', label: '👅 Suck' },
                { id: 'act_grind', label: '🍑 Grind' }
            ];
            let selectedActions: string[] = [];

            const buildSimulationEmbed = () => {
                const desc = simActions.map(a => `${selectedActions.includes(a.id) ? '[x]' : '[ ]'} ${a.label}`).join('\n');
                return new EmbedBuilder()
                    .setTitle(title)
                    .setColor('#ff69b4')
                    .setDescription(`**Simulation Progress: (Select 3 actions)**\n\n${desc}`)
                    .setThumbnail(embedImage);
            };

            const buildSimulationRow = () => {
                const row = new ActionRowBuilder<ButtonBuilder>();
                for (const a of simActions) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(a.id)
                            .setLabel(a.label)
                            .setStyle(selectedActions.includes(a.id) ? ButtonStyle.Secondary : ButtonStyle.Primary)
                            .setDisabled(selectedActions.includes(a.id))
                    );
                }
                return row;
            };

            await interaction.update({ content: cheatingPrefix ? `🔥 **Session Starting...**\n${cheatingPrefix}` : '🔥 **Session Starting...**', embeds: [buildSimulationEmbed()], components: [buildSimulationRow()] });

            const simCollector = proposalMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => [message.author.id, target.id].includes(i.user.id),
                time: 120000
            });

            simCollector.on('collect', async (simInt) => {
                if (simInt.customId.startsWith('act_')) {
                    if (!selectedActions.includes(simInt.customId)) {
                        selectedActions.push(simInt.customId);
                    }

                    if (selectedActions.length >= 3) {
                        const finalEmbed = buildSimulationEmbed().setDescription(
                            `**Simulation Progress:**\n\n${simActions.map(a => `${selectedActions.includes(a.id) ? '[x]' : '[ ]'} ${a.label}`).join('\n')}\n\n🔥 **You are about to finish!**`
                        );
                        const finalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder().setCustomId('sim_cum').setLabel('Cum (Inside)').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('sim_nocum').setLabel('Don\'t Cum (Pull Out)').setStyle(ButtonStyle.Danger)
                        );
                        await simInt.update({ content: cheatingPrefix ? `💦 **Climax Approaching!**\n${cheatingPrefix}` : '', embeds: [finalEmbed], components: [finalRow] });
                    } else {
                        await simInt.update({ content: cheatingPrefix ? `🥵 **Getting hotter...**\n${cheatingPrefix}` : '', embeds: [buildSimulationEmbed()], components: [buildSimulationRow()] });
                    }
                } else if (simInt.customId === 'sim_cum') {
                    await simInt.update({ content: cheatingPrefix ? `✅ **Session Complete.** ${message.author} and ${target} had a wild time and finished inside!\n${cheatingPrefix}` : `✅ **Session Complete.** ${message.author} and ${target} had a wild time and finished inside!`, embeds: [], components: [] });
                    simCollector.stop('cum');
                } else if (simInt.customId === 'sim_nocum') {
                    await simInt.update({ content: cheatingPrefix ? `✅ **Session Complete.** ${message.author} and ${target} stopped smoothly. No risk!\n${cheatingPrefix}` : `✅ **Session Complete.** ${message.author} and ${target} stopped smoothly. No risk!`, embeds: [], components: [] });
                    simCollector.stop('nocum');
                }
            });

            simCollector.on('end', async (_, reason) => {
                if (reason === 'cum') {
                    // 2. Pregnancy Chance (50%)
                    const hasFoid = authorData.gender === 'Foid' || targetData.gender === 'Foid';
                    if (hasFoid && Math.random() < 0.5) {
                        // Determine who is the Foid (if both, target gets choice)
                        const foidUser = targetData.gender === 'Foid' ? target : message.author;
                        const otherUser = foidUser.id === target.id ? message.author : target;

                        const pregEmbed = new EmbedBuilder()
                            .setTitle('🤰 Conception!')
                            .setDescription(`<@${foidUser.id}>, you have been impregnated by <@${otherUser.id}>! What will you do?`)
                            .setColor('#FFC0CB');

                        const pregRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder().setCustomId('preg_keep').setLabel('Keep Child').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('preg_abort').setLabel('Abort').setStyle(ButtonStyle.Danger)
                        );

                        const pregMsg = await (message.channel as any).send({
                            content: `<@${foidUser.id}>`,
                            embeds: [pregEmbed],
                            components: [pregRow]
                        });

                        const pregCollector = pregMsg.createMessageComponentCollector({
                            componentType: ComponentType.Button,
                            filter: i => i.user.id === foidUser.id,
                            time: 60000
                        });

                        pregCollector.on('collect', async (pregInt) => {
                            if (pregInt.customId === 'preg_abort') {
                                await pregInt.update({ content: '💔 The pregnancy was terminated.', embeds: [], components: [] });
                                pregCollector.stop();
                            } else {
                                // Open Naming Modal
                                const modal = new ModalBuilder()
                                    .setCustomId('kid_naming_modal')
                                    .setTitle('Name Your Child');

                                const nameInput = new TextInputBuilder()
                                    .setCustomId('kid_name_input')
                                    .setLabel('Child Name')
                                    .setPlaceholder('Enter a name for the baby...')
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                                    .setMaxLength(32);

                                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));

                                await pregInt.showModal(modal);

                                try {
                                    const submit = await (pregInt as any).awaitModalSubmit({
                                        filter: i => i.customId === 'kid_naming_modal' && i.user.id === foidUser.id,
                                        time: 60000
                                    });

                                    const kidName = submit.fields.getTextInputValue('kid_name_input');

                                    // Save to DB
                                    const motherId = foidUser.id;
                                    const fatherId = otherUser.id;

                                    await Kid.create({
                                        name: kidName,
                                        motherId,
                                        fatherId,
                                        guildId: message.guildId
                                    });

                                    await (submit as any).update({
                                        content: `🍼 **A new life!** <@${foidUser.id}> and <@${otherUser.id}> are now the parents of **${kidName}**! Check them in \`$kids\`.`,
                                        embeds: [],
                                        components: []
                                    });
                                    pregCollector.stop();

                                } catch (err) {
                                    console.error('Naming Modal Error:', err);
                                }
                            }
                        });
                    }
                } else if (reason === 'time') {
                    proposalMsg.edit({ content: '⏰ Simulation timed out.', embeds: [], components: [] }).catch(() => { });
                }
            });

            collector.stop('started');
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                proposalMsg.edit({ content: '⏰ No consent received. Session cancelled.', embeds: [], components: [] }).catch(() => { });
            }
        });
    }
};

export default command;
