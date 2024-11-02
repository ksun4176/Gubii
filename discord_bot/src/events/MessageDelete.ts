import { Events, Message, OmitPartialGroupDMChannel, PartialMessage } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { ChannelPurposeType } from "../DatabaseHelper";
import { getGuildApplyMessageInfo } from "../helpers/ApplyHelper";

const messageDeleteEvent: EventInterface<Events.MessageDelete> = {
    name: Events.MessageDelete,
	async execute(message: OmitPartialGroupDMChannel<Message> | PartialMessage) {
        // only handling messages from threads: Recruitment
        if (!message.inGuild()) {
            return;
        }
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            const messageInfo = await getGuildApplyMessageInfo(prisma, databaseHelper, message);
            if (!messageInfo) {
                return;
            }
            const { sourceChannel, targetThread } = messageInfo;

            try {
                // only delete forwarded messages sent from recruitment thread
                if (sourceChannel.channelType !== ChannelPurposeType.Recruitment) {
                    return;
                }

                const messages = await targetThread.messages.fetch({ limit: 50 });
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
                    return embed.footer.text === message.id;
                })
                if (!targetMessage) {
                    throw new Error('Message to delete not found. Might be too old now.');
                }
                await targetMessage.delete();
            }
            catch (error) {
                await message.channel.send(`Delete failed. If you feel strongly about this, you can go to <#${targetThread.id}> to delete it manually`);
                console.error(error);
            }
        }
        catch (error) {
            await message.channel.send(`Delete failed. If you feel strongly about this, you can go to the corresponding applicant thread to delete it manually`);
            console.error(error);
        }
    },
}

export = messageDeleteEvent;