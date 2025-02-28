import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, GuildMember, MessageCreateOptions, PartialGuildMember } from "discord.js";
import { BaseEvent } from '../../utils/structures/BaseEvent';
import GuildApplyButton from "../../buttons/GuildApply";
import { ServerEvent } from "@prisma/client";

export default class GuildMemberAddEvent extends BaseEvent<Events.GuildMemberAdd> {
  constructor() {
    super(Events.GuildMemberAdd);
  }

  override async execute(member: GuildMember | PartialGuildMember): Promise<void> {
    const discordServer = member.guild;
    try {
      const { prisma, databaseHelper } = await this.GetHelpers();
      const server = await databaseHelper.getServer(discordServer.client, discordServer);
      if (!server) return;
      const user = await databaseHelper.getUser(member.user);

      const welcomeMessage = await prisma.serverMessage.findUnique({ where: {
        serverId_event: {
          serverId: server.id,
          event: ServerEvent.ServerMemberAdd
        }
      }});
      if (!welcomeMessage || !welcomeMessage.channelId) {
        return;
      }

      const discordChannel = await discordServer.channels.fetch(welcomeMessage.channelId);
      if (!discordChannel?.isSendable()) {
        return;
      }
      
      const messageInfo = await databaseHelper.replaceMessagePlaceholders(welcomeMessage.text, user, server);
      const message: MessageCreateOptions = {
        content: messageInfo.formatted
      }
      if (messageInfo.apply) {
        const guildApplyButton = new GuildApplyButton();
        const applyButton = new ButtonBuilder()
          .setCustomId(guildApplyButton.getCustomId())
          .setLabel('Apply to Guilds')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📋');
        
        message.components = [new ActionRowBuilder<ButtonBuilder>().addComponents(applyButton)];
      }
      await discordChannel.send(message);
    }
    catch (error) {
        console.log(error);
    }
  }
}