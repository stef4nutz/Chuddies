import { Command } from '../types/Command';
import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const INTERACTION_COLOR = '#2b2d31';

const command: Command = {
    name: 'game',
    description: 'Search for a game or get a random recommendation powered by RAWG.',
    execute: async (message, args) => {
        const apiKey = process.env.RAWG_API_KEY;
        if (!apiKey) {
            return message.reply('⚠️ `RAWG_API_KEY` is not set in the environment. Add it to your `.env` file from [rawg.io](https://rawg.io/apidocs).');
        }

        const query = args.join(' ');
        let gameData: any = null;

        try {
            if (query) {
                // Search for a game
                const searchRes = await fetch(
                    `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=1`
                );
                const searchData = await searchRes.json() as { results: any[] };

                if (!searchData.results || searchData.results.length === 0) {
                    return message.reply(`❌ Could not find any game matching **${query}**.`);
                }
                gameData = searchData.results[0];
            } else {
                // Get a random recommendation
                const randomPage = Math.floor(Math.random() * 200) + 1;
                const randomRes = await fetch(
                    `https://api.rawg.io/api/games?key=${apiKey}&page=${randomPage}&page_size=20&ordering=-rating&metacritic=80,100`
                );
                const randomData = await randomRes.json() as { results: any[] };

                if (!randomData.results || randomData.results.length === 0) {
                    return message.reply('Could not fetch a game recommendation right now. Try again later!');
                }
                gameData = randomData.results[Math.floor(Math.random() * randomData.results.length)];
            }

            // Fetch detailed data for better description and metacritic link
            const detailRes = await fetch(`https://api.rawg.io/api/games/${gameData.id}?key=${apiKey}`);
            const game = await detailRes.json() as any;

            const genres = game.genres?.map((g: any) => g.name).join(', ') || 'Unknown';
            const platforms = game.platforms?.map((p: any) => p.platform.name).slice(0, 4).join(', ') || 'Unknown';
            const rating = game.rating ? `⭐ ${game.rating}/5` : 'Not rated';
            const metacritic = game.metacritic ? `📉 ${game.metacritic}` : 'N/A';
            const released = game.released ? `📅 ${game.released}` : 'Unknown';
            const website = game.website ? `[Official Website](${game.website})` : 'No website';

            const description = game.description_raw
                ? (game.description_raw.length > 400 ? game.description_raw.substring(0, 400) + '...' : game.description_raw)
                : 'No description available.';

            const embed = new EmbedBuilder()
                .setTitle(`🎮 The chud recommends you to play ${game.name}`)
                .setURL(`https://rawg.io/games/${game.slug}`)
                .setDescription(description)
                .setColor(INTERACTION_COLOR)
                .setImage(game.background_image || null)
                .addFields(
                    { name: 'Rating', value: rating, inline: true },
                    { name: 'Metacritic', value: metacritic, inline: true },
                    { name: 'Released', value: released, inline: true },
                    { name: 'Genres', value: genres, inline: true },
                    { name: 'Platforms', value: platforms, inline: true },
                    { name: 'Links', value: website, inline: true }
                )
                .setFooter({ text: 'Powered by RAWG.io • Tip: Add a game name to search!' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } catch (err) {
            console.error('[Game] Error:', err);
            return message.reply('Failed to process game request. Try again later!');
        }
    }
};

export default command;

