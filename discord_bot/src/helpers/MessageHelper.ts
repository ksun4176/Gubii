import { EmbedBuilder, Message, SendableChannels } from "discord.js";

/**
 * Forward a message to a channel in embed form.
 * Attachments will also be included in a separate message.
 * Stickers cannot be sent right now
 * @param message Message to be forwarded
 * @param channel Channel to forward message to
 */
export const forwardNewMessage = async (message: Message, channel: SendableChannels) => {
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
    //     await channel.send({ stickers: [...message.stickers.values()] });
    // }
}