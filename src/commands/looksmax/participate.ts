import { Command } from '../../types/Command';
import { TextChannel, EmbedBuilder } from 'discord.js';
import Submission from '../../database/models/Submission';
import GuildConfig from '../../database/models/GuildConfig';

const command: Command = {
    name: 'participate',
    description: 'Participate in the looksboard by submitting an image.',
    execute: async (message, args) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server.');
            return;
        }

        // Fetch server's custom channel configuration
        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config || !config.participateChannelId || !config.voteChannelId) {
            await message.reply('This server has not been configured. An Admin must use `$looks setup #participate #voting`.');
            return;
        }

        // Enforce channel restriction dynamically
        if (message.channel.id !== config.participateChannelId) {
            await message.reply(`This command can only be used in <#${config.participateChannelId}>.`);
            return;
        }

        // Check if an image is attached
        const attachment = message.attachments.first();
        if (!attachment || !attachment.contentType?.startsWith('image/')) {
            await message.reply('You must attach an image to participate!');
            return;
        }

        // Verify the voting channel exists
        const votingChannel = message.client.channels.cache.get(config.voteChannelId) as TextChannel;
        if (!votingChannel) {
            await message.reply('Error: Configured voting channel could not be found. Please check permissions or run setup again.');
            return;
        }

        try {
            // Create Embed for the voting channel
            const embed = new EmbedBuilder()
                .setTitle(`New Submission from ${message.author.username}`)
                .setDescription(`React with 👍 or 👎`)
                .setImage(attachment.url)
                .setColor('#2b2d31')
                .setFooter({ text: `User ID: ${message.author.id} | Voting open for 1 hour` })
                .setTimestamp();

            // Send to the voting channel
            const votingMessage = await votingChannel.send({ embeds: [embed] });

            // Jumpstart voting by adding reactions
            await votingMessage.react('👍');
            await votingMessage.react('👎');

            // Save the submission tracking state in MongoDB with the nested guildId
            await Submission.create({
                discordId: message.author.id,
                guildId: message.guild.id,
                messageId: votingMessage.id,
                channelId: votingMessage.channel.id,
            });

            // Confirm submission
            await message.reply('Your submission has been safely routed to the voting channel! Results will be calculated in 1 hour.');
        } catch (error) {
            console.error('Error in participate command:', error);
            await message.reply('An error occurred while creating your submission.');
        }
    }
};

export default command;
