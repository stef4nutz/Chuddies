import { Command } from '../types/Command';
import User from '../database/models/User';

const command: Command = {
    name: 'transfer',
    description: 'Transfer Chudbucks to another user.',
    execute: async (message, args) => {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('Usage: `$transfer @user <amount>`');
        }

        if (target.id === message.author.id) {
            return message.reply("You can't transfer money to yourself!");
        }

        const amountStr = args[1];
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount <= 0) {
            return message.reply('Please provide a valid, positive amount of <:chudbucks:1491251114157277314> Chudbucks to transfer.');
        }

        const sender = await User.findOne({ discordId: message.author.id, guildId: guildId });

        if (!sender || sender.balance < amount) {
            return message.reply(`You don't have enough <:chudbucks:1491251114157277314> Chudbucks! You currently have **${sender?.balance || 0}**.`);
        }

        // Perform the transfer
        sender.balance -= amount;
        await sender.save();

        let recipient = await User.findOne({ discordId: target.id, guildId: guildId });
        if (!recipient) {
            recipient = new User({ discordId: target.id, guildId: guildId, balance: 0 });
        }
        recipient.balance += amount;
        await recipient.save();

        return message.reply(`Successfully transferred **${amount} <:chudbucks:1491251114157277314> Chudbucks** to **${target.username}**!`);
    }
};

export default command;
