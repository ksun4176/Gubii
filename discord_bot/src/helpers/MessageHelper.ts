import { BaseChannel, EmbedBuilder, GuildMessageManager, Message, PartialMessage, SendableChannels } from "discord.js";

/**
 * Forward a message to a channel in embed form.
 * Attachments will also be included in a separate message.
 * Stickers cannot be sent right now
 * @param message Message to be forwarded
 * @param channel Channel to forward message to
 */
export async function forwardNewMessage (message: Message, channel: SendableChannels) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: message.author.displayName, iconURL: message.author.avatarURL() ?? undefined })
    .setFooter({ text: message.id })
    .setTimestamp();
  if (message.content) {
    embed.setDescription(message.content);
  }
  else {
    embed.setDescription('Linking files...');
  }
  await channel.send({ embeds: [embed] });
  if (message.attachments.size > 0) {
    await channel.send({ files: [...message.attachments.values()] });
  }
  // if (message.stickers.size > 0) {
  //   await channel.send({ stickers: [...message.stickers.values()] });
  // }
}

/**
 * Find the forwarded message
 * @param sentMessage The message that was forwarded
 * @param channel The channel to look for the forwarded message in
 * @returns 
 */
export async function findForwardedMessage (sentMessage: Message | PartialMessage, channel: BaseChannel & {messages: GuildMessageManager}) {
  const messages = await channel.messages.fetch({ limit: 50 });
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
    return embed.footer.text === sentMessage.id;
  });
  return targetMessage;
}