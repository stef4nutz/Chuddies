import { Command } from '../../types/Command';
import User from '../../database/models/User';

const ADMIN_ID = '413326085065801729';

const command: Command = {
    name: 'addmoney',
    description: 'Admin command to grant Chudbucks to a user.',
    execute: async (message, args) => {
        // Restricted to specified Discord ID
        if (message.author.id !== ADMIN_ID) {
            return message.reply("You do not have permission to use this command.");
        }

        const guildId = message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first();
        const amountStr = args[1];
        const amount = parseInt(amountStr);

        if (!target || isNaN(amount)) {
            return message.reply('Usage: `$addmoney @user <amount>`');
        }

        let userRecord = await User.findOne({ discordId: target.id, guildId: guildId });
        if (!userRecord) {
            userRecord = new User({ discordId: target.id, guildId: guildId, balance: 0, job: 'Unemployed' });
        }

        userRecord.balance += amount;
        await userRecord.save();

        return message.reply(`Successfully granted **${amount} <:chudbucks:1491251114157277314> Chudbucks** to **${target.username}**!`);
    }
};

export default command;
