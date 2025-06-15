const { Client } = require('discord.js-selfbot-v13');
const axios = require('axios');

const sourceClient = new Client({ checkUpdate: false });
const destinationClient = new Client({ checkUpdate: false });

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

async function fetchImageAsBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch image from URL: ${url}`, error);
        return null;
    }
}

async function getOrCreateWebhook(channel, username, avatarURL) {
    if (!webhookCache[channel.id]) {
        const avatarBuffer = await fetchImageAsBuffer(avatarURL);
        const webhook = await channel.createWebhook(username, {
            avatar: `data:image/png;base64,${Buffer.from(avatarBuffer).toString('base64')}`
        });
        webhookCache[channel.id] = webhook;
    }
    return webhookCache[channel.id];
}

function replaceMentions(content, guild) {
    return content.replace(/<@!?(\d+)>/g, (match, userId) => {
        const member = guild.members.cache.get(userId);
        if (member) {
            return `@${member.user.username}`;
        }
        return match;
    });
}

sourceClient.on('messageCreate', async (message) => {
    const sourceSettings = Settings.Mirror.source.find(source => 
        message.guild.id === source.guildId && message.channel.id === source.channelId
    );

    if (sourceSettings) {
        const destinationGuild = destinationClient.guilds.cache.get(sourceSettings.destination.guildId);
        if (destinationGuild) {
            const destinationChannel = destinationGuild.channels.cache.get(sourceSettings.destination.channelId);
            if (destinationChannel) {
                try {
                    const avatarURL = message.author.displayAvatarURL({ format: 'png' });
                    const webhook = await getOrCreateWebhook(destinationChannel, message.author.username, avatarURL);

                    let content = message.content || "";
                    content = replaceMentions(content, message.guild);

                    if (message.reference) {
                        const repliedToMessage = await message.channel.messages.fetch(message.reference.messageId);
                        if (repliedToMessage) {
                            const repliedToUser = repliedToMessage.member ? repliedToMessage.member.displayName : repliedToMessage.author.username;
                            content = `**Replying to ${repliedToUser}**: "${repliedToMessage.content}"\n\n${content}`;
                        }
                    }

                    const embed = {
                        description: `**${message.member ? message.member.displayName : message.author.username} (${message.author.username})**:\n${content}`,
                        thumbnail: {
                            url: avatarURL
                        }
                    };

                    const files = [];
                    if (message.attachments.size > 0) {
                        message.attachments.forEach(attachment => {
                            files.push({ attachment: attachment.url, name: attachment.name });
                        });
                    }

                    if (content.trim().length > 0 || files.length > 0) {
                        await webhook.send({
                            embeds: [embed],
                            files: files
                        });
                    } else {
                        console.error("Cannot send an empty message.");
                    }
                } catch (error) {
                    console.error("Failed to send message to the destination channel:", error);
                }
            } else {
                console.error("Destination channel not found");
            }
        } else {
            console.error("Destination server not found");
        }
    }
});

sourceClient.login(Settings.SourceToken);
destinationClient.login(Settings.DestinationToken);