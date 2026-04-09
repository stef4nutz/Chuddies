import { Command } from '../../types/Command';
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
import User from '../../database/models/User';
import Kid from '../../database/models/Kid';

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

        // Guild-only guard
        if (!message.guild || !message.guildId) {
            return message.reply('This command can only be used in a server!');
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

        // ── 1. Proposal ──────────────────────────────────────────────────────────
        const proposalEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`${target}, ${message.author.username} wants to esex with you. Do you consent?`)
            .setColor('#ff69b4')
            .setThumbnail(embedImage);

        const proposalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            components: [proposalRow]
        });

        // ── 2. Await consent ─────────────────────────────────────────────────────
        let consentInteraction: any = null;
        try {
            consentInteraction = await proposalMsg.awaitMessageComponent({
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === target.id,
                time: 60_000
            });
        } catch {
            // Timed out
            await proposalMsg.edit({ content: '⏰ No consent received. Session cancelled.', embeds: [], components: [] }).catch(() => { });
            return;
        }

        if (consentInteraction.customId === 'esex_decline') {
            await consentInteraction.update({ content: `❌ ${target.username} declined. No session today.`, embeds: [], components: [] });
            return;
        }

        // ── 3. Simulation ────────────────────────────────────────────────────────
        const simActions = [
            { id: 'act_kiss', label: '💋 Kiss' },
            { id: 'act_touch', label: '✋ Touch' },
            { id: 'act_stroke', label: '🍆 Stroke' },
            { id: 'act_suck', label: '👅 Suck' },
            { id: 'act_grind', label: '🍑 Grind' }
        ];
        const selectedActions: string[] = [];

        const buildSimEmbed = () => {
            const desc = simActions.map(a => `${selectedActions.includes(a.id) ? '[x]' : '[ ]'} ${a.label}`).join('\n');
            return new EmbedBuilder()
                .setTitle(title)
                .setColor('#ff69b4')
                .setDescription(`**Simulation Progress: (Select 3 actions)**\n\n${desc}`)
                .setThumbnail(embedImage);
        };

        const buildSimRow = () => {
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

        // Update message to show the simulation — using the consent interaction
        await consentInteraction.update({
            content: cheatingPrefix ? `🔥 **Session Starting...**\n${cheatingPrefix}` : '🔥 **Session Starting...**',
            embeds: [buildSimEmbed()],
            components: [buildSimRow()]
        });

        // ── 4. Sim collector ─────────────────────────────────────────────────────
        const simCollector = proposalMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => [message.author.id, target.id].includes(i.user.id),
            time: 120_000
        });

        simCollector.on('collect', async (simInt) => {
            if (!simInt.customId.startsWith('act_') && simInt.customId !== 'sim_cum' && simInt.customId !== 'sim_nocum') return;

            if (simInt.customId.startsWith('act_')) {
                if (!selectedActions.includes(simInt.customId)) {
                    selectedActions.push(simInt.customId);
                }

                if (selectedActions.length >= 3) {
                    const finalEmbed = new EmbedBuilder()
                        .setTitle(title)
                        .setColor('#ff69b4')
                        .setDescription(
                            `**Simulation Progress:**\n\n${simActions.map(a => `${selectedActions.includes(a.id) ? '[x]' : '[ ]'} ${a.label}`).join('\n')}\n\n🔥 **You are about to finish!**`
                        )
                        .setThumbnail(embedImage);

                    const finalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('sim_cum').setLabel('Cum (Inside)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('sim_nocum').setLabel("Don't Cum (Pull Out)").setStyle(ButtonStyle.Danger)
                    );
                    await simInt.update({ content: cheatingPrefix || '', embeds: [finalEmbed], components: [finalRow] });
                } else {
                    await simInt.update({
                        content: cheatingPrefix ? `🥵 **Getting hotter...**\n${cheatingPrefix}` : '🥵 **Getting hotter...**',
                        embeds: [buildSimEmbed()],
                        components: [buildSimRow()]
                    });
                }

            } else if (simInt.customId === 'sim_cum' || simInt.customId === 'sim_nocum') {
                const isCum = simInt.customId === 'sim_cum';

                const finishEmbed = new EmbedBuilder()
                    .setTitle('💦 E-sex Concluded')
                    .setDescription(isCum
                        ? `✅ **Session Complete.** ${message.author} and ${target} had a wild time and finished inside!`
                        : `✅ **Session Complete.** ${message.author} and ${target} stopped smoothly. No risk!`)
                    .setColor(isCum ? '#ff69b4' : '#808080')
                    .setImage('https://i.imgur.com/TiJZ1NG.png')
                    .setTimestamp();

                await simInt.update({
                    content: cheatingPrefix || '',
                    embeds: [finishEmbed],
                    components: []
                }).catch(err => console.error('[Esex] Final update error:', err));

                simCollector.stop(isCum ? 'cum' : 'nocum');
            }
        });

        simCollector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await proposalMsg.edit({ content: '⏰ Simulation timed out.', embeds: [], components: [] }).catch(() => { });
                return;
            }

            if (reason !== 'cum') return;

            // ── 5. Pregnancy chance (50/50) ────────────────────────────────────
            if (Math.random() >= 0.5) return;

            // Decide who gets pregnant — prefer the Foid if there is one, otherwise target
            const foidUser = (authorData.gender === 'Foid') ? message.author
                           : (targetData.gender === 'Foid') ? target
                           : target; // fallback: target carries the child
            const otherUser = foidUser.id === target.id ? message.author : target;

            // Generate gender at conception so the mom sees it BEFORE naming
            const kidGender: 'boy' | 'girl' = Math.random() < 0.5 ? 'boy' : 'girl';
            const genderLabel = kidGender === 'boy' ? '👦 Boy' : '👧 Girl';
            const genderEmoji = kidGender === 'boy' ? '👦' : '👧';

            const pregEmbed = new EmbedBuilder()
                .setTitle('🤰 Conception!')
                .setDescription([
                    `<@${foidUser.id}>, you have been impregnated by <@${otherUser.id}>!`,
                    ``,
                    `${genderEmoji} **It's a ${genderLabel}!**`,
                    ``,
                    `What will you do?`
                ].join('\n'))
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

            // Await the Foid's decision with awaitMessageComponent (no nested collector)
            let pregInteraction: any = null;
            try {
                pregInteraction = await pregMsg.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    filter: (i: any) => i.user.id === foidUser.id,
                    time: 60_000
                });
            } catch {
                await pregMsg.edit({ content: '⏰ No decision made. The pregnancy… remains uncertain.', embeds: [], components: [] }).catch(() => { });
                return;
            }

            if (pregInteraction.customId === 'preg_abort') {
                await pregInteraction.update({ content: '💔 The pregnancy was terminated.', embeds: [], components: [] });
                return;
            }

            // ── 6. Naming modal ────────────────────────────────────────────────
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
            await pregInteraction.showModal(modal);

            let submit: any = null;
            try {
                submit = await pregInteraction.awaitModalSubmit({
                    filter: (i: any) => i.customId === 'kid_naming_modal' && i.user.id === foidUser.id,
                    time: 60_000
                });
            } catch {
                // Modal dismissed or timed out — silently ignore
                return;
            }

            const kidName = submit.fields.getTextInputValue('kid_name_input').trim();

            // Gender was already determined at conception (shown in the pregnancy embed)
            await Kid.create({
                name: kidName,
                motherId: foidUser.id,
                fatherId: otherUser.id,
                guildId: message.guildId!,
                gender: kidGender
            });

            // Bug fix: ModalSubmitInteraction has no .update() — use .reply() instead
            await submit.reply({
                content: [
                    `🍼 **A new life!** <@${foidUser.id}> and <@${otherUser.id}> are now the proud parents of **${kidName}**! 🎉`,
                    `${genderEmoji} **It's a ${genderLabel}!**`,
                    `Check them with \`$kid ${kidName}\` or \`$kids\`.`
                ].join('\n'),
                embeds: [],
                components: []
            });

            // Clean up preg message
            await pregMsg.edit({ content: `✅ They kept the baby — **${kidName}** (${genderLabel})!`, embeds: [], components: [] }).catch(() => { });
        });
    }
};

export default command;
