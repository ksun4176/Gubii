import { EmbedBuilder, Events, Message, PartialMessage } from "discord.js";
import { BaseEvent } from '../../utils/structures/BaseEvent';
import { getGuildApplyMessageInfo } from "../../helpers/ApplyHelper";
import { findForwardedMessage } from "../../helpers/MessageHelper";

export default class MessageUpdateEvent extends BaseEvent<Events.MessageUpdate> {
  constructor() {
    super(Events.MessageUpdate);
  }

  override async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
    // only handling messages from threads: Recruitment + Applicant
    if (!newMessage.inGuild() || !newMessage.author || newMessage.author?.bot) {
      return;
    }
    try {
      try {
        const { prisma, databaseHelper } = await this.GetHelpers();
        const messageInfo = await getGuildApplyMessageInfo(prisma, databaseHelper, newMessage);
        if (!messageInfo) {
          return;
        }
        const { targetThread } = messageInfo;

        newMessage.content = newMessage.content.replace(`${newMessage.client.user}`, '');
        const targetMessage = await findForwardedMessage(oldMessage, targetThread);
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
    }
    catch (error) {
      console.error(error);
    }
  }
}