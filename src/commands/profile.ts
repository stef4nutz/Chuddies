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
} from 'discord.js';
import User from '../database/models/User';

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

    const embed = new EmbedBuilder()
        .setTitle(`${target.username}'s Profile`)
        .setDescription(userData.spouseId ? `💍 **Married to <@${userData.spouseId}>**` : '🕊️ **Single**')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Age', value: userData.age?.toString() || 'Not set', inline: true },
            { name: 'Abusive/BPD', value: userData.abusiveBpd || 'Not set', inline: true },
            { name: 'Truecel', value: userData.truecel || 'Not set', inline: true },
            { name: 'Racism Level', value: userData.racismLevel || 'Not set', inline: true },
            { name: 'Gender', value: userData.gender || 'Moid', inline: true },
            { name: 'Description', value: userData.description || 'No description set.' }
        )
        .setColor('#2b2d31')
        .setFooter({ text: `Level: ${userData.level} | XP: ${userData.xp}` });

    await (message.channel as any).send({ embeds: [embed] });
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
