import { EmbedBuilder, Events, Message, OmitPartialGroupDMChannel } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { ChannelPurposeType, UserRoleType } from "../DatabaseHelper";
import { getGuildApplyMessageInfo } from "../helpers/ApplyHelper";

const messageCreateEvent: EventInterface<Events.MessageCreate> = {
    name: Events.MessageCreate,
	async execute(newMessage: OmitPartialGroupDMChannel<Message>) {
        // only handling messages from threads: Recruitment + Applicant
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            const messageInfo = await getGuildApplyMessageInfo(prisma, databaseHelper, newMessage);
            if (!messageInfo) {
                return;
            }
            const { sourceChannel, targetChannel, targetThread } = messageInfo;
    
            // only forward newMessage from recruitment thread if starting with "\";
            if (sourceChannel.channelType === ChannelPurposeType.Recruitment) {
                if (newMessage.content.startsWith('\\')) {
                    newMessage.content = newMessage.content.slice(1);
                }
                else {
                    return;
                }
            }
            // notify management again if thread has been archived
            if (targetChannel.channelType === ChannelPurposeType.Recruitment && targetThread.archived) {
                const managementRoles = await prisma.userRole.findMany({ where: { OR: [
                    {
                        roleType: UserRoleType.GuildLead,
                        serverId: targetChannel.serverId,
                        guildId: targetChannel.guildId
                    },
                    {
                        roleType: UserRoleType.GuildManagement,
                        serverId: targetChannel.serverId,
                        guildId: targetChannel.guildId
                    }
                ] } });
                const recruitThreadMessage = `Re-adding ${managementRoles.map(role => `<@&${role.discordId}>`).join(', ')} to archived thread.`;
                await targetThread.send(recruitThreadMessage);
            }
    
            // send embed in counterpart
            const embed = new EmbedBuilder()
                .setAuthor({ name: newMessage.author.displayName, iconURL: newMessage.author.avatarURL() ?? undefined })
                .setFooter({ text: newMessage.id })
                .setTimestamp();
            if (newMessage.content) {
                embed.setDescription(newMessage.content);
            }
            else {
                embed.setDescription('Linking files...');
            }
            await targetThread.send({ embeds: [embed] });
            if (newMessage.attachments.size > 0) {
                await targetThread.send({ files: [...newMessage.attachments.values()] });
            }
            if (newMessage.stickers.size > 0) {
                await targetThread.send({ stickers: [...newMessage.stickers.values()] });
            }
            await newMessage.react('✅');
        }
        catch (error) {
            await newMessage.react('❌');
            console.error(error);
        }
    },
}
export = messageCreateEvent;