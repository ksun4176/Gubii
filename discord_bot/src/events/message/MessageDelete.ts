import { Events, Message, OmitPartialGroupDMChannel, PartialMessage } from "discord.js";
import { BaseEvent } from '../../utils/structures/BaseEvent';
import { getGuildApplyMessageInfo } from "../../helpers/ApplyHelper";
import { ChannelPurposeType } from "../../helpers/DatabaseHelper";
import { findForwardedMessage } from "../../helpers/MessageHelper";

export default class MessageDeleteEvent extends BaseEvent<Events.MessageDelete> {
  constructor() {
    super(Events.MessageDelete);
  }

  override async execute(message: OmitPartialGroupDMChannel<Message> | PartialMessage): Promise<void> {
    // only handling messages from threads: Recruitment
    if (!message.inGuild() || message.author?.bot) {
      return;
    }
    try {
      try {
        const { prisma, databaseHelper } = await this.GetHelpers();
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

          const targetMessage = await findForwardedMessage(message, targetThread, 50);
          if (!targetMessage) {
            throw new Error('Message to delete not found. Might be too old now.');
          }
          await targetMessage.delete();
        }
        catch (error) {
          await message.channel.send(`Delete failed. If you feel strongly about this, find someone to go to ${targetThread} to delete it manually`);
          console.error(error);
        }
      }
      catch (error) {
        await message.channel.send(`Delete failed. If you feel strongly about this, find someone to go to the corresponding applicant thread to delete it manually`);
        console.error(error);
      }
    }
    catch (error) {
      console.error(error);
    }
  }
}