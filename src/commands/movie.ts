import { Command } from '../types/Command';
import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const INTERACTION_COLOR = '#2b2d31';

const command: Command = {
    name: 'movie',
    description: 'Search for a movie or get a random recommendation powered by TMDB.',
    execute: async (message, args) => {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey) {
            return message.reply('⚠️ `TMDB_API_KEY` is not set in the environment. Add it to your `.env` file from [themoviedb.org](https://www.themoviedb.org/settings/api).');
        }

        const query = args.join(' ');
        let movieId: number | null = null;

        try {
            if (query) {
                // Search for a movie
                const searchRes = await fetch(
                    `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`
                );
                const searchData = await searchRes.json() as { results: any[] };

                if (!searchData.results || searchData.results.length === 0) {
                    return message.reply(`❌ Could not find any movie matching **${query}**.`);
                }
                movieId = searchData.results[0].id;
            } else {
                // Get a random recommendation
                const randomPage = Math.floor(Math.random() * 100) + 1;
                const randomRes = await fetch(
                    `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&page=${randomPage}&sort_by=popularity.desc&vote_count.gte=500`
                );
                const randomData = await randomRes.json() as { results: any[] };

                if (!randomData.results || randomData.results.length === 0) {
                    return message.reply('Could not fetch a movie recommendation right now. Try again later!');
                }
                movieId = randomData.results[Math.floor(Math.random() * randomData.results.length)].id;
            }

            // Fetch full details
            const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`);
            const movie = await detailRes.json() as any;

            const rating = movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}/10` : 'Not rated';
            const released = movie.release_date ? `📅 ${movie.release_date}` : 'Unknown';
            const runtime = movie.runtime ? `🕒 ${movie.runtime}m` : 'N/A';
            const genres = movie.genres?.map((g: any) => g.name).join(', ') || 'Unknown';
            const tagline = movie.tagline ? `*${movie.tagline}*` : '';
            
            const overview = movie.overview
                ? (movie.overview.length > 400 ? movie.overview.substring(0, 400) + '...' : movie.overview)
                : 'No description available.';
            
            const poster = movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : null;

            const embed = new EmbedBuilder()
                .setTitle(`🎬 The chud recommends you watching ${movie.title}`)
                .setURL(`https://www.themoviedb.org/movie/${movie.id}`)
                .setDescription(`${tagline}\n\n${overview}`)
                .setColor(INTERACTION_COLOR)
                .setThumbnail(poster)
                .addFields(
                    { name: 'Rating', value: rating, inline: true },
                    { name: 'Runtime', value: runtime, inline: true },
                    { name: 'Released', value: released, inline: true },
                    { name: 'Genres', value: genres, inline: false },
                    { name: 'Popularity', value: `🔥 ${Math.round(movie.popularity)}`, inline: true }
                )
                .setFooter({ text: 'Powered by TMDB • Tip: Add a movie name to search!' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } catch (err) {
            console.error('[Movie] Error:', err);
            return message.reply('Failed to process movie request. Try again later!');
        }
    }
};

export default command;

