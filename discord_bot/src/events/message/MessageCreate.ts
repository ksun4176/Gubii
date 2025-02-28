import { Events, Message, OmitPartialGroupDMChannel } from "discord.js";
import { BaseEvent } from '../../utils/structures/BaseEvent';
import { getGuildApplyMessageInfo } from "../../helpers/ApplyHelper";
import { forwardNewMessage } from "../../helpers/MessageHelper";
import { ChannelPurposeType, UserRoleType } from "@prisma/client";

export default class MessageCreateEvent extends BaseEvent<Events.MessageCreate> {
  constructor() {
    super(Events.MessageCreate);
  }

  override async execute(newMessage: OmitPartialGroupDMChannel<Message>): Promise<void> {
    if (newMessage.author.bot) {
      return;
    }
    // only handling messages from threads: Recruitment + Applicant
    try {
      try {
        const { prisma, databaseHelper } = await this.GetHelpers();
        const messageInfo = await getGuildApplyMessageInfo(prisma, databaseHelper, newMessage);
        if (!messageInfo) return;
        const { sourceChannel, targetChannel, targetThread } = messageInfo;

        // only forward newMessage if it mentions the bot
        if (sourceChannel.channelType === ChannelPurposeType.Recruitment) {
          if (!newMessage.mentions.has(newMessage.client.user)) {
            return;
          }
        }

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

        newMessage.content = newMessage.content.replace(`${newMessage.client.user}`, '');
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
  }
}