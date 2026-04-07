import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import Submission from '../database/models/Submission';
import User from '../database/models/User';

export function initCron(client: Client) {
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
                    const likeReaction = message.reactions.cache.get('👍');
                    if (likeReaction) {
                        // Subtract 1 because the bot adds the initial reaction
                        likes = Math.max(0, likeReaction.count - 1);
                    }

                    let dislikes = 0;
                    const dislikeReaction = message.reactions.cache.get('👎');
                    if (dislikeReaction) {
                        // Subtract 1 because the bot adds the initial reaction
                        dislikes = Math.max(0, dislikeReaction.count - 1);
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
