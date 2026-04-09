import { Command } from '../../types/Command';
import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import User from '../../database/models/User';

const command: Command = {
    name: 'bible',
    description: 'Get a random bible verse or a specific one. Usage: $bible [book chapter:verse]',
    execute: async (message, args) => {
        let apiUrl = 'https://bible-api.com/?random=verse';
        let isRandom = true;

        if (args.length > 0) {
            const verseQuery = args.join(' ');
            apiUrl = `https://bible-api.com/${encodeURIComponent(verseQuery)}`;
            isRandom = false;
        }

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    return message.reply('❌ Could not find that specific verse. Make sure the format is right (e.g., `John 3:16`) and that the chapter/verse exists!');
                }
                throw new Error(`API returned status ${response.status}`);
            }

            const data = await response.json();

            const text = data.text?.trim();
            const reference = data.reference;

            if (!text || !reference) {
                return message.reply('❌ Chuddie couldn\'t parse the holy word right now. Try again later.');
            }

            // --- Economy Logic ---
            let rewardGiven = false;
            let cooldownMessage = "";
            if (message.guild) {
                let userRecord = await User.findOne({ discordId: message.author.id, guildId: message.guild.id });
                if (!userRecord) {
                    userRecord = new User({ discordId: message.author.id, guildId: message.guild.id });
                }

                const now = new Date();
                const lastBible = userRecord.lastBible;
                const dailyCooldown = 24 * 60 * 60 * 1000; // 24 Hours

                if (!lastBible || (now.getTime() - lastBible.getTime()) >= dailyCooldown) {
                    userRecord.balance += 1000;
                    userRecord.lastBible = now;
                    await userRecord.save();
                    rewardGiven = true;
                } else {
                    const timeLeftMs = dailyCooldown - (now.getTime() - lastBible.getTime());
                    const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                    cooldownMessage = `\n\n(Next blessing reward available in **${hours}h ${minutes}m**)`;
                }
            }
            // --------------------

            const chudbucksEmoji = '<:chudbucks:1491251114157277314>';
            const rewardText = rewardGiven ? `🎁 **You were blessed with 1000 ${chudbucksEmoji} Chudbucks!**\n\n` : '';

            const bibleEmbed = new EmbedBuilder()
                .setTitle(`📖 ${reference}`)
                .setDescription(`${rewardText}${text.length > 2000 ? text.substring(0, 2045) + '...' : text}${cooldownMessage}`)
                .setColor('#f1c40f')
                .setThumbnail('https://i.imgur.com/IJNEAnr.png')
                .setFooter({ text: `Chud says read the bible on a daily basis and you will be blessed` });

            return message.reply({ embeds: [bibleEmbed] });

        } catch (error) {
            console.error('[Bible Command] Error:', error);
            return message.reply('❌ Failed to fetch from the heavens. The Bible API might be down.');
        }
    }
};

export default command;
