require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,  
    ],
});


const TOKEN = process.env.DISCORD_TOKEN;
const AFK_ROLE_NAME = 'MIA';
const ON_LEAVE_CHANNEL_NAME = 'on-leave-notice';
const GAME_CATEGORIES = [
    'THRONE & LIBERTY',
    'APEX LEGENDS',
    'COUNTER-STRIKE',
    'ONCE HUMAN',
    'VALORANT',
    'LEAGUE OF LEGENDS',
    'PATH OF EXILE 2'
];

const INACTIVE_PERIOD = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check every 24 hours

// File to store last activity
const activityFile = './lastActivity.json';
let lastActivity = {};

// Load last activity data from file
if (fs.existsSync(activityFile)) {
    lastActivity = JSON.parse(fs.readFileSync(activityFile, 'utf8'));
}

// Save activity data to file
function saveActivity() {
    fs.writeFileSync(activityFile, JSON.stringify(lastActivity, null, 2));
}

// Update user activity
function updateActivity(userId) {
    lastActivity[userId] = Date.now();
    saveActivity();
}

// Check if a channel is part of a game-specific category
function isInGameCategory(channel) {
    return channel.parent && GAME_CATEGORIES.includes(channel.parent.name);
}

// Check inactivity and assign AFK role
async function checkInactivity() {
    const guild = client.guilds.cache.first();
    const afkRole = guild.roles.cache.find(role => role.name === AFK_ROLE_NAME);
    const leaveChannel = guild.channels.cache.find(
        channel => channel.name === ON_LEAVE_CHANNEL_NAME
    );

    if (!afkRole) {
        console.error('AFK role not found!');
        return;
    }

    for (const member of guild.members.cache.values()) {
        if (member.user.bot || member.roles.cache.has(afkRole.id)) continue;

        const lastSeen = lastActivity[member.id] || 0;

        // Check exemption in the on-leave-notice channel
        const exemption = leaveChannel
            ? await leaveChannel.messages.fetch({ limit: 100 })
            : null;
        const isExempt = exemption?.some(
            msg => msg.author.id === member.id && msg.content.includes('!onleave')
        );

        if (isExempt) continue;

        // Check inactivity
        if (Date.now() - lastSeen > INACTIVE_PERIOD) {
            await member.roles.add(afkRole);
            await member.send(
                'You have been marked as AFK due to 5 days of inactivity. '
                + 'Send a message in any game channel or join a voice channel to remove this status.'
            );
        }
    }
}

// Event: Bot ready
client.on('ready', () => {
    console.log(`${client.user.tag} is online!`);
    setInterval(checkInactivity, CHECK_INTERVAL);
});

// Event: Message sent
client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (isInGameCategory(message.channel)) {
        updateActivity(message.author.id);
    }
});

// Event: Voice state update
client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.channel && isInGameCategory(newState.channel)) {
        updateActivity(newState.member.id);
    }
});

client.login(TOKEN);
