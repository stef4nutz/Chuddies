import { Command } from '../types/Command';
import GuildConfig from '../database/models/GuildConfig';
import User from '../database/models/User';
import { PermissionsBitField, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';

// Helper for rounded rectangles (robust for different Node/Canvas environments)
function drawRoundRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

const command: Command = {
    name: 'level',
    description: 'Check your level or configure the leveling system.',
    execute: async (message, args) => {
        if (!message.guild) return;

        const subCommand = args[0]?.toLowerCase();

        // 1. Admin Commands
        if (subCommand === 'enable') {
            if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return message.reply('You need the **Manage Server** permission to use this command!');
            }
            await GuildConfig.findOneAndUpdate(
                { guildId: message.guild.id },
                { levelingEnabled: true },
                { upsert: true }
            );
            return message.reply('✅ Leveling system has been **enabled** for this server!');
        }

        if (subCommand === 'disable') {
            if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return message.reply('You need the **Manage Server** permission to use this command!');
            }
            await GuildConfig.findOneAndUpdate(
                { guildId: message.guild.id },
                { levelingEnabled: false },
                { upsert: true }
            );
            return message.reply('❌ Leveling system has been **disabled** for this server!');
        }

        // 2. See Rank Card
        const targetMember = message.mentions.members?.first() || message.member;
        if (!targetMember) return;
        const targetUser = targetMember.user;

        let userRecord = await User.findOne({ discordId: targetUser.id, guildId: message.guild.id });
        if (!userRecord) {
            userRecord = new User({ discordId: targetUser.id, guildId: message.guild.id });
        }

        const level = userRecord.level || 1;
        const messagesCount = userRecord.messageCount || 0;
        const maxMessages = 50;

        try {
            // Initialize Canvas
            const canvas = createCanvas(800, 250);
            const ctx = canvas.getContext('2d');

            // Draw Background
            try {
                const bgPath = path.join(__dirname, '..', 'assets', 'bg.png');
                const bg = await loadImage(bgPath);
                ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
            } catch (e) {
                console.warn('[Level] Failed to load background image:', e);
                // Fallback smooth gradient if image is missing
                const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                grad.addColorStop(0, '#f0f0f0');
                grad.addColorStop(1, '#e0e0e0');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const textColor = '#1a1a1a';

            // Server Name
            ctx.fillStyle = textColor;
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(message.guild.name, 250, 225);

            // Username
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(targetUser.username, 250, 110);

            // Level Text
            ctx.font = '36px sans-serif';
            const levelStr = `LEVEL ${level}`;
            const levelMetrics = ctx.measureText(levelStr);
            ctx.fillText(levelStr, canvas.width - levelMetrics.width - 50, 60);

            // Progress Text
            ctx.font = '24px sans-serif';
            const progressStr = `${messagesCount} / ${maxMessages} messages`;
            const progressMetrics = ctx.measureText(progressStr);
            ctx.fillText(progressStr, canvas.width - progressMetrics.width - 50, 140);

            // Draw Progress Bar Background
            ctx.fillStyle = 'rgba(26, 26, 26, 0.15)'; // transparent dark layer
            drawRoundRect(ctx, 250, 160, 500, 30, 15);
            ctx.fill();

            // Draw Progress Bar Foreground
            const progressWidth = Math.min(Math.max(messagesCount / maxMessages, 0.05), 1) * 500;
            ctx.fillStyle = textColor;
            drawRoundRect(ctx, 250, 160, progressWidth, 30, 15);
            ctx.fill();

            // Draw Avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(130, 125, 80, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            
            try {
                // Ensure we request a PNG explicitly for napi-rs/canvas capability
                const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || targetUser.defaultAvatarURL;
                const avatar = await loadImage(avatarUrl);
                ctx.drawImage(avatar, 50, 45, 160, 160);
            } catch (e) {
                console.error('[Level] Failed to load avatar:', e);
            }
            ctx.restore();

            // Draw Avatar Border
            ctx.lineWidth = 6;
            ctx.strokeStyle = textColor;
            ctx.beginPath();
            ctx.arc(130, 125, 80, 0, Math.PI * 2, true);
            ctx.stroke();

            const buffer = await canvas.encode('png');
            const attachment = new AttachmentBuilder(buffer, { name: 'rank.png' });
            
            await message.reply({ files: [attachment] });

        } catch (error) {
            console.error('[Level] Error generating rank card:', error);
            await message.reply('There was an error generating your rank card.');
        }
    }
};

export default command;
