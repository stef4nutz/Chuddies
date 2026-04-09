import { Command } from '../../types/Command';
import {
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import ShopItem from '../../database/models/ShopItem';
import Inventory from '../../database/models/Inventory';
import User from '../../database/models/User';

const CHUDBUCKS_EMOJI = '<:chudbucks:1491251114157277314>';

// Default seed items added when a guild has no shop items yet
const DEFAULT_ITEMS = [
    { itemId: 'apple', name: 'Apple', description: 'A fresh red apple. Classic nutrition.', price: 50, stock: -1, emoji: '🍎' },
    { itemId: 'bread', name: 'Bread', description: 'A warm loaf of bread. Fills them right up.', price: 80, stock: -1, emoji: '🍞' },
    { itemId: 'milk', name: 'Milk', description: 'Cold glass of milk. Builds strong bones.', price: 60, stock: -1, emoji: '🥛' },
    { itemId: 'banana', name: 'Banana', description: 'High energy fruit. Kids love it.', price: 40, stock: -1, emoji: '🍌' },
    { itemId: 'pizza', name: 'Pizza Slice', description: 'Their favourite. A treat!', price: 150, stock: 100, emoji: '🍕' },
    { itemId: 'steak', name: 'Steak', description: 'Premium cut. Very filling.', price: 400, stock: 50, emoji: '🥩' },
    { itemId: 'cookie', name: 'Cookie', description: 'Sweet cookie. A dessert treat.', price: 30, stock: -1, emoji: '🍪' },
    { itemId: 'soup', name: 'Soup', description: 'Hot bowl of soup. Comforting and healthy.', price: 90, stock: -1, emoji: '🍲' },
    { itemId: 'carrot', name: 'Carrot', description: 'Healthy vegetables. Good for growth.', price: 35, stock: -1, emoji: '🥕' },
    { itemId: 'burger', name: 'Burger', description: 'Big tasty burger. Not the healthiest but kids love it.', price: 200, stock: 75, emoji: '🍔' },
];

async function seedDefaultItems(guildId: string) {
    for (const item of DEFAULT_ITEMS) {
        const exists = await ShopItem.findOne({ itemId: item.itemId, guildId });
        if (!exists) {
            await ShopItem.create({ ...item, guildId });
        }
    }
}

const command: Command = {
    name: 'shop',
    description: 'Food shop for your kids. Usage: $shop list | $shop buy <id> | $shop admin',
    execute: async (message, args) => {
        if (!message.guild) return message.reply('This command can only be used in a server!');

        const sub = args[0]?.toLowerCase();

        // Auto-seed default items on first use
        await seedDefaultItems(message.guild.id);

        // ─── $shop list ───────────────────────────────────────────────────────
        if (!sub || sub === 'list') {
            const items = await ShopItem.find({ guildId: message.guild.id }).sort({ price: 1 });
            if (items.length === 0) {
                return message.reply('The shop is currently empty. An admin can add items with `$shop admin`.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🛒 Kid Food Shop')
                .setDescription('Buy food to keep your kids fed and healthy!\nUse `$shop buy <id>` to purchase.')
                .setColor('#f5a623')
                .setFooter({ text: 'Feed your kids every 3 hours or they lose ❤️ hearts!' });

            const chunks: string[] = [];
            let current = '';
            for (const item of items) {
                const stockText = item.stock === -1 ? '∞' : `${item.stock} left`;
                const line = `${item.emoji} **${item.name}** (\`${item.itemId}\`)\n  └ ${item.description}\n  └ ${CHUDBUCKS_EMOJI} **${item.price}** | Stock: ${stockText}\n`;
                if ((current + line).length > 1000) {
                    chunks.push(current);
                    current = line;
                } else {
                    current += line;
                }
            }
            if (current) chunks.push(current);

            embed.addFields(chunks.map((c, i) => ({ name: i === 0 ? 'Items' : '​', value: c })));

            return message.reply({ embeds: [embed] });
        }

        // ─── $shop buy <id> ───────────────────────────────────────────────────
        if (sub === 'buy') {
            const itemId = args[1]?.toLowerCase();
            if (!itemId) {
                return message.reply('Usage: `$shop buy <id>` — get IDs from `$shop list`.');
            }

            const item = await ShopItem.findOne({ itemId, guildId: message.guild.id });
            if (!item) {
                return message.reply(`❌ No item with ID \`${itemId}\` found in the shop. Check \`$shop list\`.`);
            }

            if (item.stock === 0) {
                return message.reply(`❌ **${item.name}** is out of stock!`);
            }

            const user = await User.findOne({ discordId: message.author.id, guildId: message.guild.id });
            if (!user || user.balance < item.price) {
                return message.reply(`❌ You don't have enough ${CHUDBUCKS_EMOJI} Chudbucks! **${item.name}** costs **${item.price}**.`);
            }

            // Deduct balance
            user.balance -= item.price;
            await user.save();

            // Reduce stock if not unlimited
            if (item.stock !== -1) {
                item.stock -= 1;
                await item.save();
            }

            // Add to inventory
            let inventory = await Inventory.findOne({ discordId: message.author.id, guildId: message.guild.id });
            if (!inventory) {
                inventory = new Inventory({ discordId: message.author.id, guildId: message.guild.id });
            }
            const current = inventory.items.get(itemId) || 0;
            inventory.items.set(itemId, current + 1);
            await inventory.save();

            const embed = new EmbedBuilder()
                .setTitle(`${item.emoji} Purchase Successful!`)
                .setDescription(`You bought **${item.name}** for **${item.price}** ${CHUDBUCKS_EMOJI} Chudbucks!`)
                .addFields(
                    { name: 'New Balance', value: `${CHUDBUCKS_EMOJI} ${user.balance.toLocaleString()}`, inline: true },
                    { name: `${item.name} in Inventory`, value: `x${(inventory.items.get(itemId) || 0)}`, inline: true }
                )
                .setColor('#2ecc71')
                .setFooter({ text: 'Use $kid <name> → Feed button to feed your kid!' });

            return message.reply({ embeds: [embed] });
        }

        // ─── $shop inventory ──────────────────────────────────────────────────
        if (sub === 'inventory' || sub === 'inv') {
            const inventory = await Inventory.findOne({ discordId: message.author.id, guildId: message.guild.id });

            if (!inventory || inventory.items.size === 0) {
                return message.reply(`🎒 Your food inventory is empty! Visit \`$shop list\` to buy food for your kids.`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎒 ${message.author.username}'s Food Inventory`)
                .setColor('#3498db');

            let desc = '';
            for (const [itemId, qty] of inventory.items.entries()) {
                if (qty <= 0) continue;
                const shopItem = await ShopItem.findOne({ itemId, guildId: message.guild!.id });
                const emoji = shopItem?.emoji || '🍽️';
                const name = shopItem?.name || itemId;
                desc += `${emoji} **${name}** — x${qty}\n`;
            }

            embed.setDescription(desc || 'No food items in inventory.');
            return message.reply({ embeds: [embed] });
        }

        // ─── $shop admin ──────────────────────────────────────────────────────
        if (sub === 'admin') {
            const member = message.guild.members.cache.get(message.author.id)
                || await message.guild.members.fetch(message.author.id).catch(() => null);

            if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ Only **Administrators** can use `$shop admin`.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔧 Shop Admin Panel')
                .setDescription('Choose an action:')
                .setColor('#e74c3c');

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('shop_admin_add')
                    .setLabel('➕ Add Item')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('shop_admin_remove')
                    .setLabel('🗑️ Remove Item')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('shop_admin_stock')
                    .setLabel('📦 Update Stock')
                    .setStyle(ButtonStyle.Secondary)
            );

            const reply = await message.reply({ embeds: [embed], components: [row] });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === message.author.id,
                time: 60_000
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'shop_admin_add') {
                    const modal = new ModalBuilder()
                        .setCustomId('shop_add_item_modal')
                        .setTitle('Add Shop Item');

                    const itemIdInput = new TextInputBuilder()
                        .setCustomId('item_id')
                        .setLabel('Item ID (unique slug, e.g. "apple")')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(20);

                    const nameInput = new TextInputBuilder()
                        .setCustomId('item_name')
                        .setLabel('Item Name')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(50);

                    const priceInput = new TextInputBuilder()
                        .setCustomId('item_price')
                        .setLabel('Price (Chudbucks)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('e.g. 100');

                    const stockInput = new TextInputBuilder()
                        .setCustomId('item_stock')
                        .setLabel('Stock limit (-1 = unlimited)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('-1');

                    const emojiInput = new TextInputBuilder()
                        .setCustomId('item_emoji')
                        .setLabel('Emoji (single emoji)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('🍎');

                    modal.addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(itemIdInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(stockInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput)
                    );

                    await interaction.showModal(modal);

                    try {
                        const modalSubmit = await interaction.awaitModalSubmit({ time: 120_000, filter: i => i.user.id === message.author.id });
                        const itemId = modalSubmit.fields.getTextInputValue('item_id').toLowerCase().trim().replace(/\s+/g, '_');
                        const name = modalSubmit.fields.getTextInputValue('item_name').trim();
                        const price = parseInt(modalSubmit.fields.getTextInputValue('item_price'));
                        const stock = parseInt(modalSubmit.fields.getTextInputValue('item_stock'));
                        const emoji = modalSubmit.fields.getTextInputValue('item_emoji').trim() || '🍽️';

                        if (isNaN(price) || price < 1) {
                            return modalSubmit.reply({ content: '❌ Invalid price.', ephemeral: true });
                        }
                        if (isNaN(stock) || (stock < -1)) {
                            return modalSubmit.reply({ content: '❌ Invalid stock. Use -1 for unlimited.', ephemeral: true });
                        }

                        const existing = await ShopItem.findOne({ itemId, guildId: message.guild!.id });
                        if (existing) {
                            return modalSubmit.reply({ content: `❌ An item with ID \`${itemId}\` already exists!`, ephemeral: true });
                        }

                        await ShopItem.create({ itemId, name, price, stock, emoji, guildId: message.guild!.id });

                        await modalSubmit.reply({
                            content: `✅ **${emoji} ${name}** added to the shop!\n  └ Price: **${price}** ${CHUDBUCKS_EMOJI} | Stock: ${stock === -1 ? '∞' : stock}`,
                            ephemeral: false
                        });
                    } catch {
                        // Modal timed out or was dismissed — silently ignore
                    }
                }

                if (interaction.customId === 'shop_admin_remove') {
                    const modal = new ModalBuilder()
                        .setCustomId('shop_remove_item_modal')
                        .setTitle('Remove Shop Item');

                    const itemIdInput = new TextInputBuilder()
                        .setCustomId('remove_item_id')
                        .setLabel('Item ID to remove')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(itemIdInput));
                    await interaction.showModal(modal);

                    try {
                        const modalSubmit = await interaction.awaitModalSubmit({ time: 60_000, filter: i => i.user.id === message.author.id });
                        const itemId = modalSubmit.fields.getTextInputValue('remove_item_id').toLowerCase().trim();
                        const deleted = await ShopItem.findOneAndDelete({ itemId, guildId: message.guild!.id });
                        if (!deleted) {
                            return modalSubmit.reply({ content: `❌ No item with ID \`${itemId}\` found.`, ephemeral: true });
                        }
                        await modalSubmit.reply({ content: `✅ **${deleted.name}** removed from the shop.` });
                    } catch { }
                }

                if (interaction.customId === 'shop_admin_stock') {
                    const modal = new ModalBuilder()
                        .setCustomId('shop_stock_modal')
                        .setTitle('Update Stock');

                    const itemIdInput = new TextInputBuilder()
                        .setCustomId('stock_item_id')
                        .setLabel('Item ID')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const newStockInput = new TextInputBuilder()
                        .setCustomId('stock_amount')
                        .setLabel('New Stock (-1 = unlimited)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(itemIdInput),
                        new ActionRowBuilder<TextInputBuilder>().addComponents(newStockInput)
                    );

                    await interaction.showModal(modal);

                    try {
                        const modalSubmit = await interaction.awaitModalSubmit({ time: 60_000, filter: i => i.user.id === message.author.id });
                        const itemId = modalSubmit.fields.getTextInputValue('stock_item_id').toLowerCase().trim();
                        const newStock = parseInt(modalSubmit.fields.getTextInputValue('stock_amount'));

                        if (isNaN(newStock) || newStock < -1) {
                            return modalSubmit.reply({ content: '❌ Invalid stock value.', ephemeral: true });
                        }

                        const updated = await ShopItem.findOneAndUpdate(
                            { itemId, guildId: message.guild!.id },
                            { stock: newStock },
                            { new: true }
                        );

                        if (!updated) {
                            return modalSubmit.reply({ content: `❌ Item \`${itemId}\` not found.`, ephemeral: true });
                        }

                        await modalSubmit.reply({ content: `✅ Stock for **${updated.name}** updated to **${newStock === -1 ? '∞' : newStock}**.` });
                    } catch { }
                }
            });

            collector.on('end', async () => {
                await reply.edit({ components: [] }).catch(() => { });
            });

            return;
        }

        // Unknown subcommand
        return message.reply('Usage: `$shop list` | `$shop buy <id>` | `$shop inventory` | `$shop admin` (admin only)');
    }
};

export default command;
