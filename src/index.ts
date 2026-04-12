import { REST, Routes, Client, GatewayIntentBits, Collection, Message, ActivityType, Events, Partials, Interaction } from 'discord.js';
import { Command } from './types/Command';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { connectDatabase } from './database/mongoose';
import { initCron } from './handlers/cron';

// Initialize the Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// Extend Client to hold commands
declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, Command>;
    }
}
client.commands = new Collection<string, Command>();

const PREFIX = process.env.PREFIX || '$';

// Dynamically load all commands from the commands directory and its categories
const commandsPath = path.join(__dirname, 'commands');
function loadCommands(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        console.warn(`[Command Handler] Directory not found at ${dirPath}`);
        return;
    }
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            loadCommands(itemPath);
        } else if ((item.endsWith('.ts') || item.endsWith('.js')) && !item.endsWith('.map')) {
            const command: Command = require(itemPath).default;
            if (command && command.name) {
                client.commands.set(command.name, command);
                console.log(`[Command Handler] Loaded command: ${command.name}`);
            } else {
                console.warn(`[Command Handler] Skipping invalid command file: ${item}`);
            }
        }
    }
}
loadCommands(commandsPath);

// Event when the client is logged in
client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Bot] Logged in as ${readyClient.user.tag}!`);
    console.log(`[Bot] Prefix is set to: "${PREFIX}"`);

    // Function to update the bot's status
    const updateStatus = () => {
        const serverCount = client.guilds.cache.size;
        const memberCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        client.user?.setActivity({
            name: `Watching over ${serverCount} ${serverCount === 1 ? 'server' : 'servers'} with a total of ${memberCount} chuddies`,
            type: ActivityType.Playing
        });
    };

    // Initial update and set interval for every 10 minutes
    updateStatus();
    setInterval(updateStatus, 10 * 60 * 1000);

    // Register Application Commands (Slash / Context Menus)
    const registerCommands = async () => {
        try {
            console.log(`[Bot] Started refreshing application (/) commands.`);
            
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

            // Fetch currently registered commands to check for mandatory Entry Point commands
            const currentCommands = await rest.get(Routes.applicationCommands(readyClient.user.id)) as any[];
            const entryPointCommands = currentCommands.filter(cmd => cmd.type === 4);

            const localCommands = client.commands.filter(cmd => cmd.data).map(cmd => cmd.data.toJSON());
            
            // Merge local commands with any mandatory Entry Point commands
            // We ensure we don't duplicate by checking names, though entry points are special
            const finalCommands = [...localCommands];
            for (const ep of entryPointCommands) {
                if (!finalCommands.some(c => c.name === ep.name)) {
                    finalCommands.push(ep);
                }
            }

            // Register Global commands
            await rest.put(
                Routes.applicationCommands(readyClient.user.id),
                { body: finalCommands },
            );
            
            console.log(`[Bot] Successfully reloaded ${finalCommands.length} application commands globally (including ${entryPointCommands.length} entry points).`);
        } catch (error) {
            console.error(`[Bot] Error registering application commands:`, error);
        }
    };

    registerCommands();
});

import User from './database/models/User';
import GuildConfig from './database/models/GuildConfig';

// Interaction event to handle Slash and Context Menu commands
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isCommand() && !interaction.isContextMenuCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command || !command.executeInteraction) {
        if (interaction.isRepliable()) {
            await interaction.reply({ content: 'Command not found or interaction not supported.', ephemeral: true });
        }
        return;
    }

    try {
        await command.executeInteraction(interaction as any);
    } catch (error) {
        console.error(`[Error] Failed to execute interaction ${interaction.commandName}:`, error);
        if (interaction.isRepliable()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
});

// Message event to handle reading and executing commands
client.on('messageCreate', async (message: Message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Handling Leveling (only in guilds)
    if (message.guild) {
        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (config?.levelingEnabled) {
            let userRecord = await User.findOne({ discordId: message.author.id, guildId: message.guild.id });

            if (!userRecord) {
                userRecord = new User({ discordId: message.author.id, guildId: message.guild.id });
            }

            userRecord.messageCount += 1;

            if (userRecord.messageCount >= 50) {
                userRecord.level += 1;
                userRecord.messageCount = 0;
                // Notify without ping using username
                const channel = message.channel;
                if (channel && 'send' in channel) {
                    await (channel as any).send(`What a good goy ${message.author.username}, you just reached level ${userRecord.level}.`);
                }
            }

            await userRecord.save();
        }
    }

    // Command parsing (must start with prefix)
    if (!message.content.startsWith(PREFIX)) return;

    // Parse the command and arguments out of the message
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    // Mandatory Profile Check
    const publicCommands = ['profile', 'help', 'shop', 'kid', 'kids'];
    if (!publicCommands.includes(commandName)) {
        const userRecord = await User.findOne({ discordId: message.author.id, guildId: message.guild.id });
        if (!userRecord || (!userRecord.age && !userRecord.description)) {
            return message.reply('⚠️ **You need a profile to use this command!**\nRun `$profile create` to get started.');
        }
    }

    // Fetch the command from the collection
    const command = client.commands.get(commandName);

    if (!command) return;

    // Execute the command
    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`[Error] Failed to execute ${commandName}:`, error);
        await message.reply('There was an error trying to execute that command.');
    }
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Start the bot
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'your_token_here') {
    console.error('[Error] You must specify a DISCORD_TOKEN in the .env file!');
    process.exit(1);
}

// Connect to database before logging in
connectDatabase().then(() => {
    client.login(token).then(() => {
        initCron(client);
    });
});
