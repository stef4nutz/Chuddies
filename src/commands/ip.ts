import { Command } from '../types/Command';

const israelCities = [
    'Tel Aviv',
    'Jerusalem',
    'Haifa',
    'Rishon LeZion',
    'Petah Tikva',
    'Ashdod',
    'Netanya',
    'Beersheba',
    'Holon',
    'Bnei Brak',
    'Rehovot',
    'Bat Yam',
    'Eilat',
    'Ashkelon',
    'Herzliya',
    'Kfar Saba',
    'Ra\'anana',
    'Modi\'in',
    'Nahariya',
    'Ramla',
    'Lod',
    'Tiberias',
    'Afula',
    'Karmiel',
    'Safed',
    'Dimona',
    'Kiryat Shmona',
    'Ramat Gan',
    'Giv\'atayim',
    'Hadera',
    'Little St. James'
];

const generateRandomIP = () => {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
};

const command: Command = {
    name: 'ip',
    description: 'Finds the IP address of a user and shows their location.',
    execute: async (message, args) => {
        const target = message.mentions.users.first();

        if (!target) {
            return message.reply('You must mention someone to check their IP!');
        }

        const msg = await message.reply('🖥️ **Initializing hacking script...**');

        const loadingStages = [
            '💻 Bypassing mainframe security protocols...',
            '🌐 Tracking ping requests...',
            '🛰️ Accessing global satellite nodes...',
            '🔓 Decrypting target coordinates...'
        ];

        for (const stage of loadingStages) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await msg.edit(stage).catch(() => { });
        }

        const randomCity = israelCities[Math.floor(Math.random() * israelCities.length)];
        const randomIp = generateRandomIP();

        await new Promise(resolve => setTimeout(resolve, 1500));
        await msg.edit(`Ah, ${target} IP address is ${randomIp}.\n📍 ${randomCity}, Israel`).catch(() => { });
    }
};

export default command;
