import { Command } from '../types/Command';
import { PermissionsBitField } from 'discord.js';
import GuildConfig from '../database/models/GuildConfig';

const command: Command = {
    name: 'looks',
    description: 'Configure the looksboard setup. Example: $looks setup #participate #voting',
    execute: async (message, args) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server.');
            return;
        }

        // Only let administrators run the setup command
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await message.reply('You need Administrator permissions to configure the bot.');
            return;
        }

        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'setup') {
            const channels = message.mentions.channels.map(c => c.id);
            
            if (channels.length < 2) {
                await message.reply('Please mention two channels. Usage: `$looks setup #participation-channel #voting-channel`');
                return;
            }

            const participateChannelId = channels[0];
            const voteChannelId = channels[1];

            try {
                // Upsert the configuration into MongoDB
                await GuildConfig.findOneAndUpdate(
                    { guildId: message.guild.id },
                    {
                        guildId: message.guild.id,
                        participateChannelId: participateChannelId,
                        voteChannelId: voteChannelId
                    },
                    { upsert: true, new: true }
                );

                await message.reply(`✅ Successfully saved configuration!\nParticipate Channel: <#${participateChannelId}>\nVoting Channel: <#${voteChannelId}>`);
            } catch (error) {
                console.error('Error saving GuildConfig:', error);
                await message.reply('There was an error saving your configuration.');
            }
        } else {
            await message.reply('Invalid command. Use `$looks setup #participation-channel #voting-channel`');
        }
    }
};

export default command;
