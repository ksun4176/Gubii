import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma } from "@prisma/client";
import { GuildEvent, UserRoleType } from "../../utils/helpers/DatabaseHelper";

const options = {
  game: 'game',
  event: 'event',
  channel: 'channel'
}

export default class AddGameTriggersCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('addgametriggers')
      .setDescription('Add text to be sent based on actions triggered for a game')
      .addIntegerOption(option => 
        option.setName(options.game)
          .setDescription('game the trigger is for')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(option => 
        option.setName(options.event)
          .setDescription('event the trigger is for')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addChannelOption(option =>
        option.setName(options.channel)
          .setDescription('channel text should go to')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      );
    super(CommandLevel.All, data);
  }
        
  override async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
      await interaction.reply('This command needs to be ran in a server');
      return;
    }
    await interaction.deferReply();
    const serverInfo = interaction.guild;
    const gameGuildId = interaction.options.getInteger(options.game)!;
    const eventId = interaction.options.getInteger(options.event)!;
    let channelInfo = interaction.options.getChannel(options.channel);
    let errorMessage = 'There was an issue adding the trigger.\n';
    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);

      const server = await prisma.server.findUniqueOrThrow({ where: {discordId: serverInfo.id } });
      const discordCaller = await interaction.guild!.members.fetch(caller.discordId!);
      // check if server owner OR admin
      const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
        { serverId: server.id, roleType: UserRoleType.Administrator }
      ]
      const hasPermission = await databaseHelper.userHasPermission(discordCaller, serverInfo, roles);
      if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return;
      }

      let needChannel = this.__requireChannel(eventId);
      if (!needChannel) {
        channelInfo = null;
      }
      else if (!channelInfo) {
        errorMessage += 'You need to provide a channel for the message to be sent to';
        throw new Error(errorMessage);
      }

      let message = '';
      let gameGuild = await prisma.guild.findUniqueOrThrow({ where: { id: gameGuildId } });
      let guildMessage = await prisma.guildMessage.findUnique({ where: {
        serverId_guildId_eventId: {
          serverId: server.id,
          guildId: gameGuild.id,
          eventId: eventId
        }
      }});
      if (guildMessage) {
        message += `**Here is the old text:**\n${guildMessage.text}\n`;
      }
      message += `\n**You can now enter your new text in the chat:**\n`;
      await interaction.editReply(message);

      try {
        const response = await interaction.channel.awaitMessages({
          filter: message => message.author.id === caller.discordId,
          max: 1,
          time: 600_000,
        });

        let guildMessageText = response.first()!.content;
        if (!guildMessageText) {
          await interaction.followUp('Nothing was entered so text was not overwritten.');
          return;
        }
        // save message
        if (eventId === GuildEvent.Apply) {
          // remove any ``` from application text
          guildMessageText = guildMessageText.replace(/```/g,'');
        }
        await prisma.guildMessage.upsert({
          create: {
            serverId: server.id,
            guildId: gameGuild.id,
            eventId: eventId,
            text: guildMessageText,
            channelId: channelInfo?.id
          },
          where: {
            serverId_guildId_eventId: {
              serverId: server.id,
              guildId: gameGuild.id,
              eventId: eventId
            }
          },
          update: {
            text: guildMessageText,
            channelId: channelInfo?.id
          },
        })

        // display message
        message = `**Here is the now saved text:**\n`;
        switch (eventId) {
          case GuildEvent.Apply: 
            const applicationText = await databaseHelper.getGuildApplication(server, gameGuild, caller);
            message += `${applicationText!.formatted}\n`;
            break;
          default:
            const savedMessage = await prisma.guildMessage.findUniqueOrThrow({ where: {
              serverId_guildId_eventId: {
                serverId: server.id,
                guildId: gameGuild.id,
                eventId: eventId
              }
            }});
            const messageInfo = await databaseHelper.replaceMessagePlaceholders(savedMessage.text, caller, server, gameGuild);
            message += `${messageInfo.formatted}\n`;
            break;
        }
        if (channelInfo) {
          message += `\n**Text will be sent to ${channelInfo} on event trigger.**\n`;
        }
        console.log(message);
        await interaction.followUp(message);
        await databaseHelper.writeToLogChannel(serverInfo, server.id, message);
      }
      catch (error) {
        console.error(error);
        await interaction.followUp(errorMessage);
      }
    }
    catch (error) {
      console.error(error);
      await interaction.editReply(errorMessage);
    }
  }

  override async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) {
      return;
    }
    const serverInfo = interaction.guild;
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      const { prisma, databaseHelper } = await this.GetHelpers(interaction.user);
      const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });
      
      switch (focusedOption.name) {
        case options.game:
          let gameGuilds = await databaseHelper.getGameGuilds(server.id);
          await interaction.respond(
            gameGuilds.map(guild => ({ name: guild.game.name, value: guild.id }))
          );
          break;
        case options.event:
          let gameEvents = await prisma.guildEvent.findMany();
          await interaction.respond(
            gameEvents.map(event => ({ name: event.name, value: event.id }))
          );
          break;
      }
    }
    catch (error) {
      console.log(error);
    }
  }
  /**
   * Whether channel is a required parameter
   */
  private __requireChannel(event: GuildEvent) {
     switch (event) {
        case GuildEvent.Accept:
        case GuildEvent.Transfer:
          return true;
     }
     return false;
  }
}