import { Client, GatewayIntentBits, Collection, Message } from 'discord.js';
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
        GatewayIntentBits.MessageContent
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

// Dynamically load all commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command: Command = require(filePath).default;
        
        if (command && command.name) {
            client.commands.set(command.name, command);
            console.log(`[Command Handler] Loaded command: ${command.name}`);
        } else {
            console.warn(`[Command Handler] Skipping invalid command file: ${file}`);
        }
    }
} else {
    console.warn(`[Command Handler] Commands directory not found at ${commandsPath}`);
}

// Event when the client is logged in
client.once('clientReady', () => {
    console.log(`[Bot] Logged in as ${client.user?.tag}!`);
    console.log(`[Bot] Prefix is set to: "${PREFIX}"`);
});

// Message event to handle reading and executing commands
client.on('messageCreate', async (message: Message) => {
    // Ignore messages from bots or that do not start with the prefix
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    // Parse the command and arguments out of the message
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

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
