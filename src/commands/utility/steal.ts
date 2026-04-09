import { Command } from '../../types/Command';
import { PermissionsBitField, StickerFormatType } from 'discord.js';
import fetch from 'node-fetch';

const command: Command = {
    name: 'steal',
    description: 'Steal an emoji or sticker by replying to a message. Usage: $steal [name]',
    execute: async (message, args) => {
        if (!message.guild) {
            return message.reply('This command can only be used in a server.');
        }

        // Permissions Check (safely handle undefined flags in older v14 versions)
        const perfFlag1 = PermissionsBitField.Flags.ManageGuildExpressions;
        const perfFlag2 = PermissionsBitField.Flags.ManageEmojisAndStickers;

        let hasPermission = false;
        if (perfFlag1 !== undefined && message.member?.permissions.has(perfFlag1)) hasPermission = true;
        if (perfFlag2 !== undefined && message.member?.permissions.has(perfFlag2)) hasPermission = true;

        // Bypass for Administrators as fallback
        if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) hasPermission = true;

        if (!hasPermission) {
            return message.reply('❌ You need the **Manage Expressions** permission to use this command.');
        }

        // 1. Check for Emojis in arguments
        const emojiRegexGlobal = /<a?:[a-zA-Z0-9_]+:[0-9]+>/g;
        const emojiMatches = args.join(' ').match(emojiRegexGlobal);

        if (emojiMatches && emojiMatches.length > 0) {
            // Deduplicate emojis so we don't upload the exact same one twice if spammed
            const uniqueMatches = [...new Set(emojiMatches)];
            const emojisToSteal = uniqueMatches.slice(0, 50); // Limit to 50
            const success: string[] = [];
            const failed: string[] = [];

            // Let them know if we are processing many
            const statusMessage = emojisToSteal.length > 1 ? await message.reply(`Stealing ${emojisToSteal.length} emojis, please wait...`) : null;

            for (let i = 0; i < emojisToSteal.length; i++) {
                const matchStr = String(emojisToSteal[i]);
                const extractRegex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/;
                const match = matchStr.match(extractRegex);
                if (!match) continue;

                if (statusMessage) {
                    await statusMessage.edit(`Stealing emoji ${i + 1}/${emojisToSteal.length}... please wait.`).catch(() => { });
                }

                const isAnimated = matchStr.startsWith('<a:');
                const originalName = match[1];
                const id = match[2];

                // If only 1 emoji was provided, they might have specified a custom name: `$steal newname <emoji>`
                let useName = originalName;
                if (emojisToSteal.length === 1 && args[0] && !args[0].match(extractRegex)) {
                    useName = args[0];
                }

                const extension = isAnimated ? 'gif' : 'png';
                const url = `https://cdn.discordapp.com/emojis/${id}.${extension}`;

                try {
                    // Promise timer to prevent the library from hanging infinitely on rate limits
                    const createPromise = message.guild.emojis.create({
                        attachment: url,
                        name: useName
                    });

                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Discord API timed out/rate limited.')), 8000)
                    );

                    const addedEmoji = await Promise.race([createPromise, timeoutPromise]);
                    success.push(addedEmoji.toString());
                } catch (error: any) {
                    console.error(`[Steal] Error adding emoji ${useName}:`, error);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    failed.push(`\`${useName}\` (API Error: ${errorMessage})`);
                }
            }

            let resultMsg = "";
            if (success.length > 0) resultMsg += `✅ Chuddie successfully stole these emotes: ${success.join(' ')}\n`;
            if (failed.length > 0) resultMsg += `❌ Discord being gay towards your server, Supreme Chuddie couldn't stole the emojis:\n${failed.join('\n')}`;

            if (statusMessage) {
                return statusMessage.edit({ content: resultMsg }).catch(() => message.reply(resultMsg));
            } else {
                return message.reply({ content: resultMsg });
            }
        }

        // 2. Fallback to Stickers (Requires Reply)
        const repliedMessageId = message.reference?.messageId;
        if (!repliedMessageId) {
            return message.reply('❌ To steal emojis, provide them like: `$steal <emoji1> <emoji2>`.\nTo steal a sticker, you must **reply** to the message containing the sticker!');
        }

        const repliedMessage = await message.channel.messages.fetch(repliedMessageId).catch(() => null);
        if (!repliedMessage) {
            return message.reply('❌ Could not find the message you replied to.');
        }

        const sticker = repliedMessage.stickers.first();
        if (!sticker) {
            return message.reply('❌ No sticker was found in the message you replied to. Note: Emojis must be stolen by typing them next to the command!');
        }

        if (sticker.format === StickerFormatType.Lottie) {
            return message.reply("❌ Lottie (vector) stickers are currently not supported by Discord's bot upload API.");
        }

        const stickerUrl = sticker.url;
        const newName = args[0] || sticker.name;

        try {
            const addedSticker = await message.guild.stickers.create({
                file: stickerUrl,
                name: newName,
                tags: newName
            });
            return message.reply(`✅ Chuddie stole the sticker: **${addedSticker.name}**!`);
        } catch (error: any) {
            console.error('[Steal Command] Error adding sticker:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return message.reply(`❌ Discord being gay towards your server, Supreme Chuddie couldn't stole the sticker.\nAPI Error: \`${errorMessage}\``);
        }
    }
};

export default command;
