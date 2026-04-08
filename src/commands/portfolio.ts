import { Command } from '../types/Command';
import User from '../database/models/User';
import Asset from '../database/models/Asset';
import { EmbedBuilder } from 'discord.js';

const command: Command = {
    name: 'portfolio',
    description: 'View your asset holdings and their total value.',
    execute: async (message, args) => {
        const user = await User.findOne({ discordId: message.author.id, guildId: message.guild?.id });
        if (!user) {
            return message.reply('User profile not found!');
        }

        const holdings = user.portfolio;
        if (holdings.size === 0) {
            return message.reply('You don\'t own any assets yet! Check `$market` to start investing.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`${message.author.username}'s Portfolio`)
            .setColor('#3498db');

        let totalValue = 0;
        const assets = await Asset.find();

        holdings.forEach((quantity, symbol) => {
            const asset = assets.find(a => a.symbol === symbol);
            if (asset && quantity > 0) {
                const value = asset.currentPrice * quantity;
                totalValue += value;
                embed.addFields({
                    name: `${asset.name} (${asset.symbol})`,
                    value: `Amount: **${quantity}**\nValue: **${value.toFixed(2)} <:chudbucks:1491251114157277314> Chudbucks**`,
                    inline: true
                });
            }
        });

        if (embed.data.fields?.length === 0) {
            return message.reply('Your portfolio is currently empty.');
        }

        embed.setDescription(`Total Asset Value: **${totalValue.toFixed(2)} <:chudbucks:1491251114157277314> Chudbucks**`);
        return message.reply({ embeds: [embed] });
    }
};

export default command;
