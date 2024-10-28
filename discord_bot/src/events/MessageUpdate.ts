import { EmbedBuilder, Events, Message, PartialMessage } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { getGuildApplyMessageInfo } from "../DiscordHelper";

const messageUpdateEvent: EventInterface<Events.MessageUpdate> = {
    name: Events.MessageUpdate,
	async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
        // only handling messages from threads: Recruitment + Applicant
        if (!newMessage.inGuild() || !newMessage.content) {
            return;
        }
        // check if sent properly before
        if (!oldMessage.partial && !oldMessage.reactions.cache.has('✅')) {
            return;
        }
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            const messageInfo = await getGuildApplyMessageInfo(prisma, databaseHelper, newMessage);
            if (!messageInfo) {
                return;
            }
            const { targetThread } = messageInfo;

            const messages = await targetThread.messages.fetch({ limit: 10 });
            const targetMessage = messages.find((tMessage: Message) => {
                if (!tMessage.author.bot) {
                    return false;
                }
                if (tMessage.embeds.length !== 1) {
                    return false;
                }
                const embed = tMessage.embeds[0];
                if (!embed.footer) {
                    return false;
                }
                return embed.footer.text === oldMessage.id;
            })
            if (!targetMessage) {
                throw new Error('Message to edit not found. Might be too old now.');
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: newMessage.author.displayName, iconURL: newMessage.author.avatarURL() ?? undefined })
                .setFooter({ text: newMessage.id })
                .setTimestamp()
                .setDescription(newMessage.content);
            await targetMessage.edit({ embeds: [embed] });
            await newMessage.react('✏️');
        }
        catch (error) {
            await newMessage.reactions.removeAll();
            await newMessage.react('❌');
            await newMessage.channel.send('Edit failed. Try sending as new message');
            console.error(error);
        }
    },
}

export = messageUpdateEvent;