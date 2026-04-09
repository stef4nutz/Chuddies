import { Command } from '../../types/Command';
import Asset from '../../database/models/Asset';
import { EmbedBuilder } from 'discord.js';

const command: Command = {
    name: 'market',
    description: 'View the current market prices for stocks and crypto.',
    execute: async (message, args) => {
        const assets = await Asset.find();

        if (assets.length === 0) {
            return message.reply('The market is currently closed or being initialized. Try again in a minute.');
        }

        const embed = new EmbedBuilder()
            .setTitle('📈 Chudbucks Finance')
            .setDescription('Prices update every 5 minutes.\nReal time data from [CoinGecko (Crypto)](https://www.coingecko.com/) and [Finnhub (Stocks)](https://finnhub.io/)')
            .setColor('#2ecc71')
            .setTimestamp();

        assets.forEach(asset => {
            const diff = asset.currentPrice - asset.lastPrice;
            const percent = ((diff / asset.lastPrice) * 100).toFixed(2);
            const trend = diff >= 0 ? '🟢' : '🔴';
            const sign = diff >= 0 ? '+' : '';

            embed.addFields({
                name: `${asset.name} (${asset.symbol})`,
                value: `**${asset.currentPrice} <:chudbucks:1491251114157277314>**\n${trend} ${sign}${percent}%`,
                inline: true
            });
        });

        return message.reply({ embeds: [embed] });
    }
};

export default command;
