import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import Submission from '../database/models/Submission';
import User from '../database/models/User';
import Asset from '../database/models/Asset';
import Kid from '../database/models/Kid';
import fetch from 'node-fetch';

// ─── Market Config ────────────────────────────────────────────────────────────

const INITIAL_ASSETS = [
    { symbol: 'BTC', name: 'Bitcoin', price: 60000 },
    { symbol: 'ETH', name: 'Ethereum', price: 3000 },
    { symbol: 'SOL', name: 'Solana', price: 150 },
    { symbol: 'TSLA', name: 'Tesla', price: 170 },
    { symbol: 'GME', name: 'GameStop', price: 15 },
    { symbol: 'NVDA', name: 'NVIDIA', price: 850 }
];

const COINGECKO_IDS: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana'
};

const STOCK_SYMBOLS = ['TSLA', 'GME', 'NVDA'];

// ─── Market Helpers ───────────────────────────────────────────────────────────

async function fetchCryptoPrices(): Promise<Record<string, number>> {
    try {
        const ids = Object.values(COINGECKO_IDS).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
        const data = await res.json() as Record<string, { usd: number }>;
        const prices: Record<string, number> = {};
        for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
            if (data[geckoId]?.usd) prices[symbol] = data[geckoId].usd;
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
            if (data?.c && data.c > 0) prices[symbol] = data.c;
        } catch (err) {
            console.error(`[Market] Finnhub fetch failed for ${symbol}:`, err);
        }
    }
    return prices;
}

// ─── Kid Helpers ──────────────────────────────────────────────────────────────

function getSchoolStage(age: number): string {
    if (age < 3) return '👶 Infant';
    if (age <= 5) return '🎨 Preschool';
    if (age <= 11) return '📚 Elementary School';
    if (age <= 14) return '🏫 Middle School';
    if (age <= 18) return '🎒 High School';
    if (age <= 22) return '🎓 College / University';
    return '🏆 Graduated';
}

function getSchoolTransition(oldAge: number, newAge: number): string | null {
    const transitions: Record<number, string> = {
        3: '🎨 **Preschool** starts!',
        6: '📚 **Elementary School** starts!',
        12: '🏫 **Middle School** starts!',
        15: '🎒 **High School** starts!',
        19: '🎓 **College / University** starts!',
        23: '🏆 **Graduated!** They\'re all grown up! 🎉'
    };
    for (const [age, msg] of Object.entries(transitions)) {
        const ageNum = parseInt(age);
        if (oldAge < ageNum && newAge >= ageNum) return msg;
    }
    return null;
}

const DEATH_FINE = 10_000;

// ─── Try to DM a user (fallback silently) ────────────────────────────────────

async function tryDM(client: Client, userId: string, content: string): Promise<void> {
    try {
        const user = await client.users.fetch(userId);
        await user.send(content);
    } catch {
        // User has DMs disabled — silently fail
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function initCron(client: Client) {

    // ── Initialize market assets ──────────────────────────────────────────────
    (async () => {
        const validSymbols = INITIAL_ASSETS.map(a => a.symbol);
        await Asset.deleteMany({ symbol: { $nin: validSymbols } });
        for (const a of INITIAL_ASSETS) {
            const exists = await Asset.findOne({ symbol: a.symbol });
            if (!exists) {
                await Asset.create({ symbol: a.symbol, name: a.name, currentPrice: a.price, lastPrice: a.price });
                console.log(`[Market] Initialized asset: ${a.symbol}`);
            }
        }
    })();

    // ── Migrate existing kids: add missing fields & randomize gender ─────────────
    (async () => {
        const allKids = await Kid.find({});
        let migrated = 0;
        for (const kid of allKids) {
            let changed = false;
            if (typeof kid.hearts !== 'number') { kid.hearts = 10; changed = true; }
            if (typeof kid.age !== 'number') { kid.age = 0; changed = true; }
            if (!kid.lastFed) { kid.lastFed = new Date(); changed = true; }
            if (!kid.birthDate) { kid.birthDate = kid.createdAt || new Date(); changed = true; }
            if (typeof kid.isAlive !== 'boolean') { kid.isAlive = true; changed = true; }
            if (typeof kid.warningIssued !== 'boolean') { kid.warningIssued = false; changed = true; }
            if (!kid.feedLog) { kid.feedLog = []; changed = true; }
            // Only assign gender if not already set
            if (!kid.gender) { kid.gender = Math.random() < 0.5 ? 'boy' : 'girl'; changed = true; }
            if (changed) { await kid.save(); migrated++; }
        }
        if (migrated > 0) console.log(`[Kids] Migrated ${migrated} existing kids to new schema (gender randomized).`);
    })();

    // ═══════════════════════════════════════════════════════════════════════════
    // CRON 1: Kid Age Growth — every 5 hours (1 "game year" per 5 real hours)
    // ═══════════════════════════════════════════════════════════════════════════
    cron.schedule('0 */5 * * *', async () => {
        console.log('[Kids] Running age growth tick...');
        try {
            const livingKids = await Kid.find({ isAlive: true });

            for (const kid of livingKids) {
                const oldAge = kid.age;
                kid.age += 1;
                const transition = getSchoolTransition(oldAge, kid.age);

                kid.feedLog.unshift({
                    action: `🎂 Turned ${kid.age} year${kid.age !== 1 ? 's' : ''} old — ${getSchoolStage(kid.age)}`,
                    timestamp: new Date()
                });
                if (kid.feedLog.length > 50) kid.feedLog = kid.feedLog.slice(0, 50);
                await kid.save();

                // Notify parents if there's a school-stage transition
                if (transition) {
                    const msg = `🎉 **${kid.name}** just turned **${kid.age} years old!**\n${transition}\nSchool Stage: **${getSchoolStage(kid.age)}**`;
                    await tryDM(client, kid.motherId, msg);
                    await tryDM(client, kid.fatherId, msg);
                    console.log(`[Kids] ${kid.name} aged to ${kid.age} — transition: ${transition}`);
                }
            }
        } catch (err) {
            console.error('[Kids Age Cron Error]', err);
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CRON 2: Feeding reminder — every 3 hours (initial hunger warning)
    // ═══════════════════════════════════════════════════════════════════════════
    cron.schedule('0 */3 * * *', async () => {
        console.log('[Kids] Running feeding reminder tick...');
        try {
            const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
            const hungryKids = await Kid.find({
                isAlive: true,
                lastFed: { $lt: threeHoursAgo },
                warningIssued: false
            });

            for (const kid of hungryKids) {
                const hoursSince = Math.floor((Date.now() - kid.lastFed.getTime()) / 3_600_000);
                const msg = [
                    `⚠️ **${kid.name}** hasn't been fed in **${hoursSince} hour${hoursSince !== 1 ? 's' : ''}!**`,
                    `They currently have **${kid.hearts}/10** ❤️ hearts.`,
                    `Feed them within the next hour using \`$kid ${kid.name}\` → **🍎 Feed** button, or they will lose a ❤️!`,
                    `_(Buy food: \`$shop buy <id>\` | Browse: \`$shop list\`)_`
                ].join('\n');

                await tryDM(client, kid.motherId, msg);
                await tryDM(client, kid.fatherId, msg);

                kid.warningIssued = true;
                kid.feedLog.unshift({ action: `⚠️ Hunger warning sent to parents`, timestamp: new Date() });
                if (kid.feedLog.length > 50) kid.feedLog = kid.feedLog.slice(0, 50);
                await kid.save();

                console.log(`[Kids] Hunger warning sent for ${kid.name}`);
            }
        } catch (err) {
            console.error('[Kids Feeding Reminder Cron Error]', err);
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CRON 3: Heart deduction + Death check — every hour
    // ═══════════════════════════════════════════════════════════════════════════
    cron.schedule('0 * * * *', async () => {
        console.log('[Kids] Running hourly health check...');
        try {
            // Kids that had a warning issued but STILL weren't fed (warning was sent,
            // meaning they were already >3h unfed when warning fired, so now it's >4h)
            const fourHoursAgo = new Date(Date.now() - 4 * 3_600_000);
            const stillHungryKids = await Kid.find({
                isAlive: true,
                lastFed: { $lt: fourHoursAgo },
                warningIssued: true
            });

            for (const kid of stillHungryKids) {
                kid.hearts = Math.max(0, kid.hearts - 1);
                kid.warningIssued = false; // Reset for next cycle
                kid.feedLog.unshift({ action: `💔 Lost 1 heart from starvation (unfed > 4h)`, timestamp: new Date() });
                if (kid.feedLog.length > 50) kid.feedLog = kid.feedLog.slice(0, 50);

                if (kid.hearts <= 0) {
                    // ── KID DIES ──────────────────────────────────────────────
                    kid.isAlive = false;
                    kid.feedLog.unshift({ action: `💀 Died of starvation`, timestamp: new Date() });
                    if (kid.feedLog.length > 50) kid.feedLog = kid.feedLog.slice(0, 50);
                    await kid.save();

                    // Fine both parents
                    const deathMsg = [
                        `💀 **${kid.name}** has died of starvation.`,
                        `You have been fined **${DEATH_FINE.toLocaleString()}** <:chudbucks:1491251114157277314> Chudbucks for neglect.`,
                        `_"You should have fed them."_`
                    ].join('\n');

                    for (const parentId of [kid.motherId, kid.fatherId]) {
                        await tryDM(client, parentId, deathMsg);
                        // Deduct fine from balance (can go negative)
                        await User.findOneAndUpdate(
                            { discordId: parentId, guildId: kid.guildId },
                            { $inc: { balance: -DEATH_FINE } }
                        );
                    }

                    // Announce in all text channels of the guild (find first available)
                    try {
                        const guild = await client.guilds.fetch(kid.guildId).catch(() => null);
                        if (guild) {
                            const channels = guild.channels.cache.filter(c =>
                                c.isTextBased() && 'send' in c
                            );
                            const channel = channels.first() as TextChannel | undefined;
                            if (channel) {
                                await channel.send(
                                    `💀 **RIP ${kid.name}** — A child has died of starvation.\n` +
                                    `Their parents <@${kid.motherId}> and <@${kid.fatherId}> have each been fined **${DEATH_FINE.toLocaleString()}** <:chudbucks:1491251114157277314> Chudbucks.`
                                );
                            }
                        }
                    } catch (e) {
                        console.error('[Kids] Failed to send death announcement:', e);
                    }

                    console.log(`[Kids] ${kid.name} died of starvation in guild ${kid.guildId}`);
                } else {
                    await kid.save();

                    // Notify parents of heart loss
                    const heartLossMsg = [
                        `💔 **${kid.name}** lost a heart from starvation!`,
                        `They now have **${kid.hearts}/10** ❤️ hearts.`,
                        kid.hearts <= 3
                            ? `🚨 **CRITICAL:** Only ${kid.hearts} heart${kid.hearts !== 1 ? 's' : ''} remaining! Feed them NOW or they will die!`
                            : `Feed them soon using \`$kid ${kid.name}\` → **🍎 Feed** button!`
                    ].join('\n');

                    await tryDM(client, kid.motherId, heartLossMsg);
                    await tryDM(client, kid.fatherId, heartLossMsg);
                    console.log(`[Kids] ${kid.name} lost a heart. Now at ${kid.hearts}/10.`);
                }
            }
        } catch (err) {
            console.error('[Kids Health Cron Error]', err);
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CRON 4: Market price update — every 5 minutes
    // ═══════════════════════════════════════════════════════════════════════════
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
                    asset.currentPrice = Number(cryptoPrices[asset.symbol].toFixed(2));
                } else if (stockPrices[asset.symbol] !== undefined) {
                    asset.currentPrice = Number(stockPrices[asset.symbol].toFixed(2));
                } else if (STOCK_SYMBOLS.includes(asset.symbol)) {
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

    // ═══════════════════════════════════════════════════════════════════════════
    // CRON 5: Voting submission expiry — every minute
    // ═══════════════════════════════════════════════════════════════════════════
    cron.schedule('* * * * *', async () => {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const expiredSubmissions = await Submission.find({ createdAt: { $lt: oneHourAgo } });
            if (expiredSubmissions.length === 0) return;

            for (const sub of expiredSubmissions) {
                try {
                    const channel = client.channels.cache.get(sub.channelId) as TextChannel;
                    if (!channel) {
                        await Submission.deleteOne({ _id: sub._id });
                        continue;
                    }

                    let message = await channel.messages.fetch(sub.messageId);
                    message = await message.fetch(true);

                    let likes = 0;
                    const likeReaction = message.reactions.cache.find(r => r.emoji.name === '👍');
                    if (likeReaction) likes = Math.max(0, (likeReaction.count || 1) - 1);

                    let dislikes = 0;
                    const dislikeReaction = message.reactions.cache.find(r => r.emoji.name === '👎');
                    if (dislikeReaction) dislikes = Math.max(0, (dislikeReaction.count || 1) - 1);

                    const earnedXp = (likes * 5) - (dislikes * 3);

                    if (earnedXp !== 0) {
                        let userRecord = await User.findOne({ discordId: sub.discordId, guildId: sub.guildId });
                        if (!userRecord) {
                            userRecord = new User({ discordId: sub.discordId, guildId: sub.guildId, xp: 0, level: 1 });
                        }
                        userRecord.xp += earnedXp;
                        await userRecord.save();
                        const actionWord = earnedXp > 0 ? 'gained' : 'lost';
                        await message.reply(`<@${sub.discordId}>'s voting period has ended! They ${actionWord} **${Math.abs(earnedXp)} XP** (${likes} 👍, ${dislikes} 👎)!`);
                    } else {
                        await message.reply(`<@${sub.discordId}>'s voting period has ended! They gained 0 XP (${likes} 👍, ${dislikes} 👎).`);
                    }

                    await Submission.deleteOne({ _id: sub._id });
                } catch (e) {
                    console.error(`[Cron] Error processing submission ${sub._id}:`, e);
                    await Submission.deleteOne({ _id: sub._id });
                }
            }
        } catch (error) {
            console.error('[Cron Error]', error);
        }
    });

    console.log('[Cron] Initialized scheduled jobs successfully.');
}
