import { Command } from '../types/Command';
import GuildConfig from '../database/models/GuildConfig';
import { PermissionsBitField } from 'discord.js';

const command: Command = {
    name: 'level',
    description: 'Enable or disable the leveling system in this server.',
    execute: async (message, args) => {
        if (!message.guild) return;

        // Check for Administrator or Manage Guild permissions
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('You need the **Manage Server** permission to use this command!');
        }

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'enable') {
            await GuildConfig.findOneAndUpdate(
                { guildId: message.guild.id },
                { levelingEnabled: true },
                { upsert: true }
            );
            return message.reply('✅ Leveling system has been **enabled** for this server!');
        }

        if (subCommand === 'disable') {
            await GuildConfig.findOneAndUpdate(
                { guildId: message.guild.id },
                { levelingEnabled: false },
                { upsert: true }
            );
            return message.reply('❌ Leveling system has been **disabled** for this server!');
        }

        return message.reply('Usage: `$level enable` or `$level disable`');
    }
};

export default command;
