import { 
    ContextMenuCommandBuilder, 
    ApplicationCommandType, 
    MessageContextMenuCommandInteraction, 
    ApplicationIntegrationType, 
    InteractionContextType,
    Embed
} from 'discord.js';
import { Command } from '../../types/Command';

const command: Command = {
    name: 'Extract Gift',
    data: new ContextMenuCommandBuilder()
        .setName('Extract Gift')
        .setType(ApplicationCommandType.Message)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]),

    executeInteraction: async (interaction: MessageContextMenuCommandInteraction) => {
        if (!interaction.isMessageContextMenuCommand()) return;

        const message = interaction.targetMessage;
        
        // Collect all potential text sources within the message
        const textSources: string[] = [];
        
        // 1. Main message content
        if (message.content) textSources.push(message.content);
        
        // 2. Embeds (often where gifts are displayed)
        message.embeds.forEach((embed: Embed) => {
            if (embed.title) textSources.push(embed.title);
            if (embed.description) textSources.push(embed.description);
            if (embed.url) textSources.push(embed.url);
            embed.fields?.forEach(field => {
                textSources.push(field.name, field.value);
            });
            if (embed.author?.name) textSources.push(embed.author.name);
            if (embed.footer?.text) textSources.push(embed.footer.text);
        });
        
        // 3. Components (like "Open Gift" buttons if they have a URL)
        message.components.forEach((row: any) => {
            row.components.forEach((component: any) => {
                // If it's a link button, it will have a URL
                if (component.url) {
                    textSources.push(component.url);
                }
            });
        });

        const combinedText = textSources.join(' ');
        
        // Regex for Discord Gift links (Nitro gifts)
        const giftRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gift|discord\.com\/gifts|discordapp\.com\/gifts)\/[a-zA-Z0-9]+/gi;
        const matches = combinedText.match(giftRegex);

        if (matches && matches.length > 0) {
            // Remove duplicates and clean up links
            const uniqueLinks = [...new Set(matches)];

            // Send back the found links ephemerally (hidden)
            await interaction.reply({
                content: `### 🎁 Gift Links Found:\n${uniqueLinks.map(link => `- ${link}`).join('\n')}`,
                ephemeral: true
            });
        } else {
            // Inform the user if no links were found
            await interaction.reply({
                content: '❌ No Discord gift links were found in this message (checked content, embeds, and buttons).',
                ephemeral: true
            });
        }
    }
};

export default command;
