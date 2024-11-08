import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma, ServerEvent, UserRoleType } from "@prisma/client";
import { writeToLogChannel } from "../../helpers/ChannelHelper";

const options = {
  event: 'event',
  channel: 'channel'
}

export default class AddServerTriggersCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('addservertriggers')
      .setDescription('Add text to be sent based on actions triggered for the server')
      .addStringOption(option => 
        option.setName(options.event)
          .setDescription('event the trigger is for')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addChannelOption(option =>
        option.setName(options.channel)
          .setDescription('channel text should go to')
          .setRequired(true)
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
    const discordServer = interaction.guild;
    const eventId = interaction.options.getString(options.event)! as ServerEvent;
    let channelInfo = interaction.options.getChannel(options.channel)!;
    let errorMessage = 'There was an issue adding the trigger.\n';
    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);

      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      const discordCaller = await discordServer.members.fetch(caller.discordId!);
      // check if server owner OR admin
      const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
        { serverId: server.id, roleType: UserRoleType.Administrator }
      ]
      const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
      if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return;
      }

      let message = '';
      let serverMessage = await prisma.serverMessage.findUnique({ where: {
        serverId_event: {
          serverId: server.id,
          event: eventId
        }
      }});
      if (serverMessage) {
        message += `**Here is the old text:**\n${serverMessage.text}\n`;
      }
      message += `\n**You can now enter your new text in the chat:**\n`;
      await interaction.editReply(message);

      try {
        const response = await interaction.channel.awaitMessages({
          filter: message => message.author.id === caller.discordId,
          max: 1,
          time: 600_000,
        });

        let serverMessageText = response.first()!.content;
        if (!serverMessageText) {
          await interaction.followUp('Nothing was entered so text was not overwritten.');
          return;
        }
        // save message
        await prisma.serverMessage.upsert({
          create: {
            serverId: server.id,
            event: eventId,
            text: serverMessageText,
            channelId: channelInfo.id
          },
          where: {
            serverId_event: {
              serverId: server.id,
              event: eventId
            }
          },
          update: {
            text: serverMessageText,
            channelId: channelInfo.id
          },
        });
        // display message
        const savedMessage = await prisma.serverMessage.findUniqueOrThrow({ where: {
          serverId_event: {
            serverId: server.id,
            event: eventId
          }
        }});
        message = `**Here is the now saved text:**\n`;
        const messageInfo = await databaseHelper.replaceMessagePlaceholders(savedMessage.text, caller, server);
        message += `${messageInfo.formatted}\n`;
        if (eventId === ServerEvent.ServerMemberAdd && messageInfo.apply) {
          message += `__The Apply button will be added to the bottom of the message as well__\n`;
        }
        message += `\n**Text will be sent to ${channelInfo} on event trigger.**\n`;
        console.log(message);
        await interaction.followUp(message);
        await writeToLogChannel(discordServer, server, message);
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
    try {
      const serverEventKeys = Object.values(ServerEvent);
      await interaction.respond(
        serverEventKeys.map(event => ({ name: event, value: event }))
      );
    }
    catch (error) {
      console.log(error);
    }
  }
}