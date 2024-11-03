import { Events, Message, OmitPartialGroupDMChannel } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { ChannelPurposeType, UserRoleType } from "../DatabaseHelper";
import { getGuildApplyMessageInfo } from "../helpers/ApplyHelper";
import { forwardNewMessage } from "../helpers/MessageHelper";

const messageCreateEvent: EventInterface<Events.MessageCreate> = {
    name: Events.MessageCreate,
	async execute(newMessage: OmitPartialGroupDMChannel<Message>) {
        if (newMessage.author.bot) {
            return;
        }
        // only handling messages from threads: Recruitment + Applicant
        try {
            try {
                const { prisma, databaseHelper } = await GetEventInfo();
                const messageInfo = await getGuildApplyMessageInfo(prisma, databaseHelper, newMessage);
                if (!messageInfo) {
                    return;
                }
                const { sourceChannel, targetChannel, targetThread } = messageInfo;
        
                // only forward newMessage if it mentions the bot
                if (!newMessage.mentions.has(newMessage.client.user)) { 
                    // we should tell applicant thread if they did not mention the bot
                    if (sourceChannel.channelType === ChannelPurposeType.Applicant) {
                        await newMessage.channel.send(`Hi! Your message was not sent. Just mention me (${newMessage.client.user}) to it to send it.`);
                    }
                    return;
                }

                newMessage.content = newMessage.content.replace(`${newMessage.client.user}`, '');
                // notify management again if thread has been archived
                if (targetChannel.channelType === ChannelPurposeType.Recruitment && targetThread.archived) {
                    const managementRole = await prisma.userRole.findUniqueOrThrow({ where: {
                        roleType_serverId_guildId: {
                            roleType: UserRoleType.GuildManagement,
                            serverId: targetChannel.serverId,
                            guildId: targetChannel.guildId!
                        }
                    }});
                    const recruitThreadMessage = `Re-adding <@&${managementRole.discordId}> to archived thread.`;
                    await targetThread.send(recruitThreadMessage);
                }
        
                await forwardNewMessage(newMessage, targetThread);
                await newMessage.react('✅');
            }
            catch (error) {
                await newMessage.react('❌');
                console.error(error);
            }
        }
        catch (error) {
            console.error(error);
        }
    },
}
export = messageCreateEvent;