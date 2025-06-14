const { Client, GatewayIntentBits, Partials, Options } = require('discord.js-selfbot-v13');
const axios = require('axios');

function noCache() {
    return new Map();
}

const clientOptions = {
    checkUpdate: false,
    makeCache: Options.cacheWithLimits({
        MessageManager: 0,
        ChannelManager: 10,
        GuildMemberManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        UserManager: 20,
        ThreadManager: 0
    }),
    partials: [Partials.Channel],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
};

const sourceClient = new Client(clientOptions);
const destinationClient = new Client(clientOptions);

const Settings = {
    SourceToken: "SRCTOKEN",
    DestinationToken: "DESTTOKEN",
    Mirror: {
        source: [
            {
                guildId: "334314650730627072",
                channelId: "1373503780783390800",
                destination: {
                    guildId: "1223412815339983019",
                    channelId: "1373771033882001418"
                }
            },
            {
                guildId: "334314650730627072",
                channelId: "1243015938350252133",
                destination: {
                    guildId: "1223412815339983019",
                    channelId: "1373771060079628318"
                }
            },
            {
                guildId: "334314650730627072",
                channelId: "1182740236464292001",
                destination: {
                    guildId: "1223412815339983019",
                    channelId: "1373771091482378351"
                }
            }
        ]
    }
};

const webhookCache = {};

async function getOrCreateWebhook(channel, username, avatarURL) {
    if (!webhookCache[channel.id]) {
        const webhook = await channel.createWebhook(username, {
            avatar: avatarURL
        });
        webhookCache[channel.id] = webhook;
    }
    return webhookCache[channel.id];
}

function replaceMentions(content, guild) {
    return content.replace(/<@!?(\d+)>/g, async (match, userId) => {
        try {
            const member = await guild.members.fetch(userId);
            return `@${member.user.username}`;
        } catch {
            return match;
        }
    });
}

sourceClient.on('messageCreate', async (message) => {
    const sourceSettings = Settings.Mirror.source.find(source =>
        message.guild?.id === source.guildId && message.channel?.id === source.channelId
    );

    if (!sourceSettings || !message.guild) return;

    try {
        const destinationGuild = await destinationClient.guilds.fetch(sourceSettings.destination.guildId);
        const destinationChannel = await destinationGuild.channels.fetch(sourceSettings.destination.channelId);

        const avatarURL = message.author.displayAvatarURL({ format: 'png' });
        const webhook = await getOrCreateWebhook(destinationChannel, message.author.username, avatarURL);

        let content = message.content || "";
        content = await replaceMentions(content, message.guild);

        if (message.reference?.messageId) {
            try {
                const repliedToMessage = await message.channel.messages.fetch(message.reference.messageId, { cache: false });
                const repliedToUser = repliedToMessage.member?.displayName || repliedToMessage.author.username;
                content = `**Replying to ${repliedToUser}**: "${repliedToMessage.content}"\n\n${content}`;
            } catch {
                
            }
        }

        const embed = {
            description: `**${message.member?.displayName || message.author.username} (${message.author.username})**:\n${content}`,
            thumbnail: { url: avatarURL }
        };

        const files = message.attachments.map(att => ({
            attachment: att.url,
            name: att.name
        }));

        if (content.trim().length > 0 || files.length > 0) {
            await webhook.send({
                embeds: [embed],
                files: files
            });
        } else {
            console.error("cant send an empty message");
        }
    } catch (error) {
        console.error("failed to forward message:", error);
    }
});

setInterval(() => {
    for (const key in webhookCache) {
        delete webhookCache[key];
    }
    console.log("webhook cache cleared");
}, 1000 * 60 * 10);

sourceClient.login(Settings.SourceToken);
destinationClient.login(Settings.DestinationToken);