import { Command } from '../../types/Command';
import User from '../../database/models/User';
import Asset from '../../database/models/Asset';

const command: Command = {
    name: 'buy',
    description: 'Buy assets from the market with your Chudbucks.',
    execute: async (message, args) => {
        const symbol = args[0]?.toUpperCase();
        const quantity = parseFloat(args[1]);

        if (!symbol || isNaN(quantity) || quantity <= 0) {
            return message.reply('Usage: `$buy <symbol> <quantity>` (e.g., `$buy BTC 0.5`)');
        }

        const asset = await Asset.findOne({ symbol: symbol });
        if (!asset) {
            return message.reply(`Asset **${symbol}** not found in the market!`);
        }

        const cost = asset.currentPrice * quantity;
        const fee = cost * 0.01; // 1% fee
        const totalCost = cost + fee;

        const user = await User.findOne({ discordId: message.author.id, guildId: message.guild?.id });
        if (!user || user.balance < totalCost) {
            return message.reply(`You don't have enough <:chudbucks:1491251114157277314> Chudbucks! You need **${totalCost.toFixed(2)}** (including 1% fee).`);
        }

        // Deduct balance
        user.balance -= totalCost;

        // Update portfolio
        const currentAmount = user.portfolio.get(symbol) || 0;
        user.portfolio.set(symbol, currentAmount + quantity);

        await user.save();

        return message.reply(`✅ Successfully bought **${quantity} ${symbol}** for **${cost.toFixed(2)} <:chudbucks:1491251114157277314> Chudbucks** (+ **${fee.toFixed(2)}** fee)!`);
    }
};

export default command;
