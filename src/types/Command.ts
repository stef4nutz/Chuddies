import { Message, CommandInteraction, MessageContextMenuCommandInteraction } from 'discord.js';

export interface Command {
    name: string;
    description?: string;
    execute?(message: Message, args: string[]): Promise<any> | void;
    data?: any; // For registration (Slash/Context Menu)
    executeInteraction?(interaction: CommandInteraction | MessageContextMenuCommandInteraction): Promise<any> | void;
}
