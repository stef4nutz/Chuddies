import { Command } from '../types/Command';
import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    Message, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    AttachmentBuilder
} from 'discord.js';
import User from '../database/models/User';
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

const INTERACTION_TIMEOUT = 300000; // 5 minutes

const command: Command = {
    name: 'profile',
    description: 'Manage or view your profile.',
    execute: async (message, args) => {
        if (!message.guild || !message.channel.isTextBased()) {
            return message.reply('This command can only be used in a server text channel.');
        }

        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'create') {
            await handleCreate(message);
        } else if (subcommand === 'edit') {
            await handleEdit(message);
        } else {
            await handleView(message, args);
        }
    }
};

async function handleView(message: Message, args: string[]) {
    const target = message.mentions.users.first() || message.author;
    const userData = await User.findOne({ discordId: target.id, guildId: message.guildId });

    if (!userData || (!userData.age && !userData.description)) {
        if (target.id === message.author.id) {
            return message.reply('You haven\'t created a profile yet! Use `$profile create` to get started.');
        } else {
            return message.reply(`${target.username} hasn't created a profile yet.`);
        }
    }

    try {
        const canvas = createCanvas(600, 600);
        const ctx = canvas.getContext('2d');

        // Draw Background
        try {
            const bgPath = path.join(__dirname, '..', 'assets', 'bgprofile.png');
            const bg = await loadImage(bgPath);
            ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.warn('[Profile] Failed to load background image bgprofile.png:', e);
            // Fallback dark color if missing
            ctx.fillStyle = '#1e1f22';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Top Left: Level
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(`lvl ${userData.level || 1}`, 30, 60);

        // Avatar
        ctx.save();
        drawRoundRect(ctx, 30, 110, 100, 100, 15);
        ctx.clip();
        try {
            const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || target.defaultAvatarURL;
            const avatar = await loadImage(avatarUrl);
            ctx.drawImage(avatar, 30, 110, 100, 100);
        } catch (e) {
            console.error('[Profile] Failed to load avatar:', e);
        }
        ctx.restore();

        // Username
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px sans-serif';
        // Put text next to the avatar (which ends at x=130), so x=150
        ctx.fillText(target.username, 150, 175);

        // Function to draw stats
        const drawStat = (label: string, value: string, dx: number, dy: number, width: number) => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#444444'; 
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(label, dx, dy);

            ctx.textAlign = 'right';
            ctx.fillStyle = '#000000'; 
            ctx.font = 'bold 18px sans-serif';
            // Limit the value width so it doesn't overflow
            ctx.fillText(value, dx + width, dy, width - ctx.measureText(label).width - 15);
            ctx.textAlign = 'left';
        };

        const startY = 270;
        const col1X = 30;
        const col1Width = 260; // Up to 290
        const col2X = 310;
        const col2Width = 260; // Up to 570

        let spouseName = 'None';
        if (userData.spouseId) {
            try {
                const spouseUser = await message.client.users.fetch(userData.spouseId);
                spouseName = spouseUser.username;
            } catch (e) {
                spouseName = 'Unknown';
            }
        }

        drawStat('Age', userData.age?.toString() || 'N/A', col1X, startY, col1Width);
        drawStat('Gender', userData.gender || 'Unknown', col1X, startY + 40, col1Width);
        drawStat('Racism', userData.racismLevel || 'Unknown', col1X, startY + 80, col1Width);
        
        drawStat('Abusive/BPD', userData.abusiveBpd || 'Unknown', col2X, startY, col2Width);
        drawStat('Truecel', userData.truecel || 'Unknown', col2X, startY + 40, col2Width);
        drawStat('Spouse', spouseName, col2X, startY + 80, col2Width);

        // About Section
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('About', 30, 420);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#333333'; // Slightly dimmer for desc
        const description = (userData.description || 'No description set.').replace(/\n/g, ' ');

        const maxWidth = 540;
        const words = description.split(' ');
        let line = '';
        let currentY = 450;
        const lineHeight = 26;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                if (currentY + lineHeight > 580) {
                    ctx.fillText(line.trim() + '...', 30, currentY);
                    line = '';
                    break; 
                }
                ctx.fillText(line, 30, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        if (line) {
            ctx.fillText(line, 30, currentY);
        }

        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
        
        await message.reply({ files: [attachment] });

    } catch (error) {
        console.error('[Profile] Error generating image:', error);
        await message.reply('There was an error generating the profile card.');
    }
}

async function handleCreate(message: Message) {
    const existingUser = await User.findOne({ discordId: message.author.id, guildId: message.guildId });
    if (existingUser && (existingUser.age || existingUser.description)) {
        return message.reply('You already have a profile! Use `$profile edit` if you want to change it.');
    }

    await runProfileForm(message, true, existingUser);
}

async function handleEdit(message: Message) {
    const existingUser = await User.findOne({ discordId: message.author.id, guildId: message.guildId });
    if (!existingUser || (!existingUser.age && !existingUser.description)) {
        return message.reply('You don\'t have a profile to edit! Use `$profile create` first.');
    }

    await runProfileForm(message, false, existingUser);
}

async function runProfileForm(message: Message, isNew: boolean, existingData: any) {
    // Current draft state
    const formData = {
        age: existingData?.age || '',
        description: existingData?.description || '',
        racismLevel: existingData?.racismLevel || 'Not racist',
        abusiveBpd: existingData?.abusiveBpd || 'No',
        truecel: existingData?.truecel || 'No',
        gender: existingData?.gender || 'Moid'
    };

    const getEmbed = () => {
        return new EmbedBuilder()
            .setTitle(isNew ? 'Create Your Profile' : 'Edit Your Profile')
            .setDescription('Fill out the sections below. Text fields are set via the **Age & Bio** button.')
            .addFields(
                { name: 'Age', value: formData.age.toString() || 'Not set', inline: true },
                { name: 'Gender', value: formData.gender, inline: true },
                { name: 'Racism Level', value: formData.racismLevel, inline: true },
                { name: 'Abusive/BPD', value: formData.abusiveBpd, inline: true },
                { name: 'Truecel', value: formData.truecel, inline: true },
                { name: 'Description', value: formData.description || 'No description set.' }
            )
            .setColor('#2b2d31');
    };

    const getComponents = (isSaving = false) => {
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('profile_text_btn')
                .setLabel('Set Age & Bio')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(isSaving)
        );

        const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('profile_racism_menu')
                .setPlaceholder('Select Racism Level')
                .addOptions([
                    { label: 'Not racist', value: 'Not racist', default: formData.racismLevel === 'Not racist' },
                    { label: 'Slightly racist', value: 'Slightly racist', default: formData.racismLevel === 'Slightly racist' },
                    { label: 'Racist', value: 'Racist', default: formData.racismLevel === 'Racist' },
                    { label: 'Neo-nazi', value: 'Neo-nazi', default: formData.racismLevel === 'Neo-nazi' },
                ])
                .setDisabled(isSaving)
        );

        const row2_5 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('profile_gender_menu')
                .setPlaceholder('Select Gender')
                .addOptions([
                    { label: 'Moid', value: 'Moid', default: formData.gender === 'Moid' },
                    { label: 'Foid', value: 'Foid', default: formData.gender === 'Foid' },
                    { label: 'Troid', value: 'Troid', default: formData.gender === 'Troid' },
                ])
                .setDisabled(isSaving)
        );

        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('profile_abusive_btn')
                .setLabel(`Abusive/BPD: ${formData.abusiveBpd}`)
                .setStyle(formData.abusiveBpd === 'Yes' ? ButtonStyle.Success : ButtonStyle.Danger)
                .setDisabled(isSaving),
            new ButtonBuilder()
                .setCustomId('profile_truecel_btn')
                .setLabel(`Truecel: ${formData.truecel}`)
                .setStyle(formData.truecel === 'Yes' ? ButtonStyle.Success : ButtonStyle.Danger)
                .setDisabled(isSaving)
        );

        const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('profile_save_btn')
                .setLabel('Save Profile')
                .setStyle(ButtonStyle.Success)
                .setDisabled(isSaving)
        );

        return [row1, row2, row2_5, row3, row4];
    };

    const initialMsg = await message.reply({
        embeds: [getEmbed()],
        components: getComponents()
    });

    const collector = initialMsg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: INTERACTION_TIMEOUT
    });

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'profile_text_btn') {
            const modal = new ModalBuilder()
                .setCustomId('profile_text_modal')
                .setTitle('Age & Description');

            const ageInput = new TextInputBuilder()
                .setCustomId('modal_age')
                .setLabel('Age')
                .setPlaceholder('Enter age (number)')
                .setValue(formData.age.toString())
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('modal_desc')
                .setLabel('Description')
                .setPlaceholder('Tell us about yourself...')
                .setValue(formData.description)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(ageInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
            );

            await interaction.showModal(modal);

            try {
                const modalSubmit = await (interaction as any).awaitModalSubmit({
                    filter: i => i.customId === 'profile_text_modal' && i.user.id === message.author.id,
                    time: 60000
                });

                formData.age = modalSubmit.fields.getTextInputValue('modal_age');
                formData.description = modalSubmit.fields.getTextInputValue('modal_desc');

                await (modalSubmit as any).update({
                    embeds: [getEmbed()],
                    components: getComponents()
                });
            } catch (err) {
                // Timeout
            }

        } else if (interaction.customId === 'profile_racism_menu') {
            if (interaction.isStringSelectMenu()) {
                formData.racismLevel = interaction.values[0];
                await interaction.update({ embeds: [getEmbed()], components: getComponents() });
            }

        } else if (interaction.customId === 'profile_gender_menu') {
            if (interaction.isStringSelectMenu()) {
                formData.gender = interaction.values[0];
                await interaction.update({ embeds: [getEmbed()], components: getComponents() });
            }

        } else if (interaction.customId === 'profile_abusive_btn') {
            formData.abusiveBpd = formData.abusiveBpd === 'Yes' ? 'No' : 'Yes';
            await interaction.update({ embeds: [getEmbed()], components: getComponents() });

        } else if (interaction.customId === 'profile_truecel_btn') {
            formData.truecel = formData.truecel === 'Yes' ? 'No' : 'Yes';
            await interaction.update({ embeds: [getEmbed()], components: getComponents() });

        } else if (interaction.customId === 'profile_save_btn') {
            const ageNum = parseInt(formData.age.toString());
            if (isNaN(ageNum)) {
                return interaction.reply({ content: 'Age must be a valid number!', ephemeral: true });
            }

            await interaction.update({
                content: 'Saving your profile...',
                embeds: [getEmbed()],
                components: getComponents(true)
            });

            await User.findOneAndUpdate(
                { discordId: message.author.id, guildId: message.guildId },
                { 
                    $set: {
                        age: ageNum,
                        description: formData.description,
                        racismLevel: formData.racismLevel,
                        gender: formData.gender,
                        abusiveBpd: formData.abusiveBpd,
                        truecel: formData.truecel
                    }
                },
                { upsert: true, new: true }
            );

            await interaction.editReply({ 
                content: `✅ Your profile has been ${isNew ? 'created' : 'updated'} successfuly!`, 
                components: [] 
            });
            collector.stop('saved');
        }
    });

    collector.on('end', (_, reason) => {
        if (reason !== 'saved') {
            initialMsg.edit({ content: 'Interaction timed out.', components: [] }).catch(() => {});
        }
    });
}

export default command;
