import { Command } from '../../types/Command';
import User from '../../database/models/User';
import Asset from '../../database/models/Asset';

const command: Command = {
    name: 'sell',
    description: 'Sell assets from your portfolio for Chudbucks.',
    execute: async (message, args) => {
        const symbol = args[0]?.toUpperCase();
        const quantity = parseFloat(args[1]);

        if (!symbol || isNaN(quantity) || quantity <= 0) {
            return message.reply('Usage: `$sell <symbol> <quantity>` (e.g., `$sell BTC 0.5`)');
        }

        const user = await User.findOne({ discordId: message.author.id, guildId: message.guild?.id });
        if (!user) {
            return message.reply('User profile not found!');
        }

        // Check ownership
        const currentAmount = user.portfolio.get(symbol) || 0;
        if (currentAmount < quantity) {
            return message.reply(`You don't own enough **${symbol}**! You currently have **${currentAmount}**.`);
        }

        const asset = await Asset.findOne({ symbol: symbol });
        if (!asset) {
            return message.reply(`Asset **${symbol}** not found in the market!`);
        }

        const saleValue = asset.currentPrice * quantity;
        const fee = saleValue * 0.01; // 1% fee
        const netProfit = saleValue - fee;

        // Deduct from portfolio
        user.portfolio.set(symbol, currentAmount - quantity);

        // Add to balance
        user.balance += netProfit;

        await user.save();

        return message.reply(`✅ Successfully sold **${quantity} ${symbol}** for **${netProfit.toFixed(2)} <:chudbucks:1491251114157277314> Chudbucks** (- **${fee.toFixed(2)}** fee)!`);
    }
};

export default command;
