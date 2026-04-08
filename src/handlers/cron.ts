import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import Submission from '../database/models/Submission';
import User from '../database/models/User';
import Asset from '../database/models/Asset';
import fetch from 'node-fetch';

const INITIAL_ASSETS = [
    { symbol: 'BTC', name: 'Bitcoin', price: 60000 },
    { symbol: 'ETH', name: 'Ethereum', price: 3000 },
    { symbol: 'SOL', name: 'Solana', price: 150 },
    { symbol: 'TSLA', name: 'Tesla', price: 170 },
    { symbol: 'GME', name: 'GameStop', price: 15 },
    { symbol: 'NVDA', name: 'NVIDIA', price: 850 }
];

// CoinGecko IDs mapped to our symbols
const COINGECKO_IDS: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana'
};

// Finnhub stock symbols (real-time data)
const STOCK_SYMBOLS = ['TSLA', 'GME', 'NVDA'];

async function fetchCryptoPrices(): Promise<Record<string, number>> {
    try {
        const ids = Object.values(COINGECKO_IDS).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        const data = await res.json() as Record<string, { usd: number }>;

        const prices: Record<string, number> = {};
        for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
            if (data[geckoId]?.usd) {
                prices[symbol] = data[geckoId].usd;
            }
        }
        return prices;
    } catch (err) {
        console.error('[Market] CoinGecko fetch failed:', err);
        return {};
    }
}

async function fetchStockPrices(): Promise<Record<string, number>> {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (!finnhubKey) {
        console.warn('[Market] FINNHUB_API_KEY not set — using simulated stock prices.');
        return {};
    }

    const prices: Record<string, number> = {};
    for (const symbol of STOCK_SYMBOLS) {
        try {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
            const data = await res.json() as { c: number };
            if (data?.c && data.c > 0) {
                prices[symbol] = data.c; // 'c' = current price
            }
        } catch (err) {
            console.error(`[Market] Finnhub fetch failed for ${symbol}:`, err);
        }
    }
    return prices;
}

export function initCron(client: Client) {
    // Initialize Assets if they don't exist, prune removed ones
    (async () => {
        const validSymbols = INITIAL_ASSETS.map(a => a.symbol);

        // Remove any stale assets no longer in the list (e.g. CHUD)
        await Asset.deleteMany({ symbol: { $nin: validSymbols } });

        for (const a of INITIAL_ASSETS) {
            const exists = await Asset.findOne({ symbol: a.symbol });
            if (!exists) {
                await Asset.create({
                    symbol: a.symbol,
                    name: a.name,
                    currentPrice: a.price,
                    lastPrice: a.price
                });
                console.log(`[Market] Initialized asset: ${a.symbol}`);
            }
        }
    })();

    // Run every 5 minutes to update market prices
    cron.schedule('*/5 * * * *', async () => {
        try {
            const [cryptoPrices, stockPrices] = await Promise.all([
                fetchCryptoPrices(),
                fetchStockPrices()
            ]);

            const assets = await Asset.find();
            for (const asset of assets) {
                asset.lastPrice = asset.currentPrice;

                if (cryptoPrices[asset.symbol] !== undefined) {
                    // Crypto: real price from CoinGecko
                    asset.currentPrice = Number(cryptoPrices[asset.symbol].toFixed(2));
                } else if (stockPrices[asset.symbol] !== undefined) {
                    // Stocks: real price from Finnhub
                    asset.currentPrice = Number(stockPrices[asset.symbol].toFixed(2));
                } else if (STOCK_SYMBOLS.includes(asset.symbol)) {
                    // Fallback: simulate ±3% drift if Finnhub key is missing
                    const drift = (Math.random() * 0.06) - 0.03;
                    asset.currentPrice = Math.max(0.01, Number((asset.currentPrice * (1 + drift)).toFixed(2)));
                }

                await asset.save();
            }
            console.log(`[Market] Prices updated: ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            console.error('[Market Cron Error]', error);
        }
    });

    // Run every minute to check for expired submissions
    cron.schedule('* * * * *', async () => {
        try {
            // Find submissions older than 1 hour (3600000 ms)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            const expiredSubmissions = await Submission.find({
                createdAt: { $lt: oneHourAgo }
            });

            if (expiredSubmissions.length === 0) return;

            for (const sub of expiredSubmissions) {
                try {
                    const channel = client.channels.cache.get(sub.channelId) as TextChannel;
                    if (!channel) {
                        console.warn(`[Cron] Channel ${sub.channelId} not found, skipping message ${sub.messageId}.`);
                        await Submission.deleteOne({ _id: sub._id });
                        continue;
                    }

                    // Fetch the original message from discord
                    const message = await channel.messages.fetch(sub.messageId);
                    
                    // Default exactly to 0 if the reaction isn't found
                    let likes = 0;
                    const likeReaction = message.reactions.cache.find(r => r.emoji.name === '👍');
                    if (likeReaction) {
                        // Subtract 1 because the bot adds the initial reaction
                        likes = Math.max(0, (likeReaction.count || 1) - 1);
                    }

                    let dislikes = 0;
                    const dislikeReaction = message.reactions.cache.find(r => r.emoji.name === '👎');
                    if (dislikeReaction) {
                        // Subtract 1 because the bot adds the initial reaction
                        dislikes = Math.max(0, (dislikeReaction.count || 1) - 1);
                    }

                    // Calculate XP (+5 for like, -3 for dislike)
                    const earnedXp = (likes * 5) - (dislikes * 3);

                    if (earnedXp !== 0) {
                        // Add XP to the User DB tightly bound to the guild
                        let userRecord = await User.findOne({ discordId: sub.discordId, guildId: sub.guildId });
                        if (!userRecord) {
                            userRecord = new User({ discordId: sub.discordId, guildId: sub.guildId, xp: 0, level: 1 });
                        }
                        
                        userRecord.xp += earnedXp;
                        await userRecord.save();
                        
                        // Notify the user or channel optionally
                        const actionWord = earnedXp > 0 ? "gained" : "lost";
                        await message.reply(`<@${sub.discordId}>'s voting period has ended! They ${actionWord} **${Math.abs(earnedXp)} XP** (${likes} 👍, ${dislikes} 👎)!`);
                    } else {
                        await message.reply(`<@${sub.discordId}>'s voting period has ended! They gained 0 XP (${likes} 👍, ${dislikes} 👎).`);
                    }

                    // Safely delete from active Submissions
                    await Submission.deleteOne({ _id: sub._id });

                } catch (e) {
                    console.error(`[Cron] Error processing submission ${sub._id}:`, e);
                    // Decide whether you want to delete it or retry later. If it's a 404 Unknown Message, you might want to delete it.
                    await Submission.deleteOne({ _id: sub._id });
                }
            }
        } catch (error) {
            console.error('[Cron Error]', error);
        }
    });

    console.log('[Cron] Initialized scheduled jobs successfully.');
}
