import { Command } from '../../types/Command';
import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} from 'discord.js';
import Kid, { IKid } from '../../database/models/Kid';
import Inventory from '../../database/models/Inventory';
import ShopItem from '../../database/models/ShopItem';
import path from 'path';

const CHUDBUCKS_EMOJI = '<:chudbucks:1491251114157277314>';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSchoolStage(age: number): string {
    if (age < 3) return '👶 Infant';
    if (age <= 5) return '🎨 Preschool';
    if (age <= 11) return '📚 Elementary School';
    if (age <= 14) return '🏫 Middle School';
    if (age <= 18) return '🎒 High School';
    if (age <= 22) return '🎓 College / University';
    return '🏆 Graduated';
}

function getHeartsDisplay(hearts: number): string {
    const full = '❤️';
    const empty = '🖤';
    return full.repeat(Math.max(0, hearts)) + empty.repeat(Math.max(0, 10 - hearts));
}

function getTimeSinceString(date: Date): string {
    const ms = Date.now() - date.getTime();
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours >= 1) return `${hours}h ${minutes}m ago`;
    return `${minutes}m ago`;
}

function getWojakPath(kid: IKid): string {
    const isAdult = kid.age >= 18;
    const base = isAdult
        ? kid.gender === 'girl' ? 'wojak_girl' : 'wojak_boy'
        : kid.gender === 'girl' ? 'wojak_girl' : 'wojak_boy';
    return path.join(__dirname, '..', '..', 'assets', `${base}.png`);
}

// ─── Build the kid embed ──────────────────────────────────────────────────────

async function buildKidEmbed(kid: IKid, requesterId: string) {
    const schoolStage = getSchoolStage(kid.age);
    const heartsDisplay = getHeartsDisplay(kid.hearts);
    const timeSinceFeeding = getTimeSinceString(kid.lastFed);
    const hungerWarning = (Date.now() - kid.lastFed.getTime()) > 3 * 3_600_000 ? '⚠️ **HUNGRY!**' : '✅ Fed';

    const embed = new EmbedBuilder()
        .setTitle(`${kid.gender === 'girl' ? '👧' : '👦'} ${kid.name}`)
        .setColor(kid.hearts > 5 ? '#2ecc71' : kid.hearts > 2 ? '#f39c12' : '#e74c3c')
        .addFields(
            { name: '🎂 Age', value: `${kid.age} year${kid.age !== 1 ? 's' : ''} old`, inline: true },
            { name: '🏫 School', value: schoolStage, inline: true },
            { name: '❤️ Hearts', value: heartsDisplay, inline: false },
            { name: '🍽️ Last Fed', value: `${timeSinceFeeding} — ${hungerWarning}`, inline: false }
        )
        .setThumbnail('attachment://kid.png')
        .setFooter({ text: `Gender: ${kid.gender === 'girl' ? 'Girl 👧' : 'Boy 👦'} • Feed every 3 hours to keep hearts full!` });

    if (!kid.isAlive) {
        embed.setColor('#2c2c2c')
            .setTitle(`💀 ${kid.name} (Deceased)`)
            .setDescription('This child has passed away. May they rest in peace.');
    }

    return embed;
}

// ─── Command ──────────────────────────────────────────────────────────────────

const command: Command = {
    name: 'kid',
    description: 'View and interact with one of your children. Usage: $kid <name>',
    execute: async (message, args) => {
        if (!message.guild) return message.reply('This command can only be used in a server!');

        const kidName = args.join(' ').trim();
        if (!kidName) {
            return message.reply('Usage: `$kid <name>` — specify your kid\'s name.');
        }

        // Find all kids with this name belonging to this parent in this guild
        const kids = await Kid.find({
            guildId: message.guild.id,
            name: { $regex: new RegExp(`^${kidName}$`, 'i') },
            $or: [
                { motherId: message.author.id },
                { fatherId: message.author.id }
            ]
        });

        if (kids.length === 0) {
            return message.reply(`❌ You don't have a child named **${kidName}** in this server.\nCheck your children with \`$kids\`.`);
        }

        // ── Disambiguation picker if multiple kids share the same name ──────
        let selectedKid: IKid;

        if (kids.length === 1) {
            selectedKid = kids[0];
        } else {
            // Build a picker
            const pickEmbed = new EmbedBuilder()
                .setTitle(`🔍 Multiple kids named "${kidName}"`)
                .setDescription('You have more than one child with this name. Which one?')
                .setColor('#3498db');

            const buttons = kids.slice(0, 5).map((k, i) =>
                new ButtonBuilder()
                    .setCustomId(`pick_kid_${i}`)
                    .setLabel(`${i + 1}. Born ${new Date(k.birthDate).toLocaleDateString()} (${k.gender})`)
                    .setStyle(ButtonStyle.Primary)
            );

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
            const pickMsg = await message.reply({ embeds: [pickEmbed], components: [row] });

            try {
                const pick = await pickMsg.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    filter: i => i.user.id === message.author.id && i.customId.startsWith('pick_kid_'),
                    time: 30_000
                });
                const idx = parseInt(pick.customId.replace('pick_kid_', ''));
                selectedKid = kids[idx];
                await pick.update({ components: [] });
            } catch {
                await pickMsg.edit({ content: 'Selection timed out.', components: [] });
                return;
            }
        }

        const kid = selectedKid;

        // ── Wojak image attachment ────────────────────────────────────────────
        const imgPath = getWojakPath(kid);
        const attachment = new AttachmentBuilder(imgPath, { name: 'kid.png' });

        const embed = await buildKidEmbed(kid, message.author.id);

        // ── Buttons ───────────────────────────────────────────────────────────
        const feedBtn = new ButtonBuilder()
            .setCustomId('kid_feed')
            .setLabel('🍎 Feed')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!kid.isAlive);

        const renameBtn = new ButtonBuilder()
            .setCustomId('kid_rename')
            .setLabel('✏️ Rename')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!kid.isAlive);

        const logBtn = new ButtonBuilder()
            .setCustomId('kid_log')
            .setLabel('📜 Activity Log')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(feedBtn, renameBtn, logBtn);

        const reply = await message.reply({ embeds: [embed], components: [row], files: [attachment] });

        // ── Component collector ───────────────────────────────────────────────
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === message.author.id,
            time: 120_000
        });

        collector.on('collect', async (interaction) => {

            // ── FEED ───────────────────────────────────────────────────────────
            if (interaction.customId === 'kid_feed') {
                // Re-fetch to get fresh data
                const freshKid = await Kid.findById(kid._id);
                if (!freshKid || !freshKid.isAlive) {
                    return interaction.reply({ content: '💀 This child is no longer alive.', ephemeral: true });
                }

                // Check this user is a parent
                if (freshKid.motherId !== message.author.id && freshKid.fatherId !== message.author.id) {
                    return interaction.reply({ content: '❌ Only the parents can feed this child!', ephemeral: true });
                }

                // Get inventory
                const inventory = await Inventory.findOne({ discordId: message.author.id, guildId: message.guild!.id });

                if (!inventory || inventory.items.size === 0) {
                    return interaction.reply({
                        content: `❌ Your food inventory is empty! Buy food from the shop with \`$shop buy <id>\`.\nCheck available items with \`$shop list\`.`,
                        ephemeral: true
                    });
                }

                // Find first food item in inventory with qty > 0
                let usedItemId: string | null = null;
                let usedItem: any = null;
                for (const [itemId, qty] of inventory.items.entries()) {
                    if (qty > 0) {
                        const shopItem = await ShopItem.findOne({ itemId, guildId: message.guild!.id });
                        if (shopItem) {
                            usedItemId = itemId;
                            usedItem = shopItem;
                            break;
                        }
                    }
                }

                if (!usedItemId || !usedItem) {
                    return interaction.reply({ content: '❌ No valid food items in your inventory. Buy from `$shop buy <id>`.', ephemeral: true });
                }

                // Use item
                const currentQty = inventory.items.get(usedItemId) || 0;
                if (currentQty <= 0) {
                    return interaction.reply({ content: `❌ You're out of **${usedItem.name}**! Buy more from the shop.`, ephemeral: true });
                }

                inventory.items.set(usedItemId, currentQty - 1);
                await inventory.save();

                // Update kid
                freshKid.lastFed = new Date();
                freshKid.warningIssued = false;
                // Restore a heart if below max and was hungry
                if (freshKid.hearts < 10) freshKid.hearts = Math.min(10, freshKid.hearts + 1);
                freshKid.feedLog.unshift({ action: `Fed with ${usedItem.emoji} ${usedItem.name} by <@${message.author.id}>`, timestamp: new Date() });
                if (freshKid.feedLog.length > 50) freshKid.feedLog = freshKid.feedLog.slice(0, 50);
                await freshKid.save();

                const newEmbed = await buildKidEmbed(freshKid, message.author.id);
                const newAttachment = new AttachmentBuilder(getWojakPath(freshKid), { name: 'kid.png' });

                await interaction.update({ embeds: [newEmbed], files: [newAttachment] });
                await interaction.followUp({ content: `🍎 You fed **${freshKid.name}** with **${usedItem.emoji} ${usedItem.name}**! ❤️ Hearts: ${freshKid.hearts}/10`, ephemeral: true });
            }

            // ── RENAME ─────────────────────────────────────────────────────────
            if (interaction.customId === 'kid_rename') {
                const modal = new ModalBuilder()
                    .setCustomId('kid_rename_modal')
                    .setTitle(`Rename ${kid.name}`);

                const nameInput = new TextInputBuilder()
                    .setCustomId('new_name')
                    .setLabel('New Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(32)
                    .setPlaceholder(kid.name);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
                await interaction.showModal(modal);

                try {
                    const modalSubmit = await interaction.awaitModalSubmit({
                        time: 60_000,
                        filter: i => i.user.id === message.author.id
                    });

                    const newName = modalSubmit.fields.getTextInputValue('new_name').trim();
                    const oldName = kid.name;

                    await Kid.findByIdAndUpdate(kid._id, {
                        name: newName,
                        $push: {
                            feedLog: {
                                $each: [{ action: `Renamed from "${oldName}" to "${newName}" by <@${message.author.id}>`, timestamp: new Date() }],
                                $position: 0,
                                $slice: 50
                            }
                        }
                    });

                    const freshKid = await Kid.findById(kid._id) as IKid;
                    const newEmbed = await buildKidEmbed(freshKid, message.author.id);
                    const newAttachment = new AttachmentBuilder(getWojakPath(freshKid), { name: 'kid.png' });

                    await modalSubmit.deferUpdate();
                    await reply.edit({ embeds: [newEmbed], files: [newAttachment] });
                    await modalSubmit.followUp({ content: `✏️ Successfully renamed **${oldName}** to **${newName}**!`, ephemeral: true });
                } catch {
                    // Modal dismissed / timed out
                }
            }

            // ── LOG ────────────────────────────────────────────────────────────
            if (interaction.customId === 'kid_log') {
                const freshKid = await Kid.findById(kid._id);
                if (!freshKid) return;

                const logEntries = freshKid.feedLog.slice(0, 10);

                const logEmbed = new EmbedBuilder()
                    .setTitle(`📜 Activity Log — ${freshKid.name}`)
                    .setColor('#9b59b6')
                    .setDescription(
                        logEntries.length === 0
                            ? '*No activity recorded yet.*'
                            : logEntries.map((e, i) =>
                                `\`${i + 1}.\` ${e.action}\n    └ <t:${Math.floor(new Date(e.timestamp).getTime() / 1000)}:R>`
                            ).join('\n\n')
                    );

                await interaction.reply({ embeds: [logEmbed], ephemeral: true });
            }
        });

        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                feedBtn.setDisabled(true),
                renameBtn.setDisabled(true),
                logBtn.setDisabled(true)
            );
            await reply.edit({ components: [disabledRow] }).catch(() => { });
        });
    }
};

export default command;
