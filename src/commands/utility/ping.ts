import { Command } from '../../types/Command';

const command: Command = {
    name: 'ping',
    description: 'Replies with Pong!',
    execute: async (message, args) => {
        await message.reply('Pong!');
    }
};

export default command;
