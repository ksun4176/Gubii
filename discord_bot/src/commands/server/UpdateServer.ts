import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { ChannelPurposeType, Prisma, UserRoleType } from "@prisma/client";
import { writeToLogChannel } from "../../helpers/ChannelHelper";

const options = {
  logChannel: 'logchannel'
}

export default class UpdateServerCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('updateserver')
      .setDescription('Update server info. Should be ran if you decide to change server name/owner.')
      .addChannelOption(option =>
        option.setName(options.logChannel)
          .setDescription('channel to log actions of the bot')
          .addChannelTypes(ChannelType.GuildText)
      );
    super(CommandLevel.All, data);
  }
        
  override async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply('This command needs to be ran in a server');
      return;
    }
    await interaction.deferReply();
    const discordServer = interaction.guild;

    const logChannelInfo = interaction.options.getChannel(options.logChannel);
    let errorMessage = 'There was an issue updating the server.\n';
    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);
      
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      const discordCaller = await discordServer.members.fetch(caller.discordId!);
      // check if server owner OR admin
      const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
      ]
      const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
      if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return;
      }
      
      // create server object
      let message = `### Server Is Updated\n` +
        `- Name: ${server.name}\n`;

      // server owner role
      let ownerRole = await prisma.userRole.findFirst({
        where: {
          serverId: server.id,
          roleType: UserRoleType.ServerOwner
        }
      });
      if (!ownerRole) {
        ownerRole = await prisma.userRole.create({
          data: {
            name: `${server.name} Owner`,
            serverId: server.id,
            roleType: UserRoleType.ServerOwner
          }
        });
      }
      message += `- Owner: <@${caller.discordId}>\n`;

      // log channel
      let logChannel = server.channels.find((channel) => {
        channel.channelType === ChannelPurposeType.BotLog
      });
      if (logChannelInfo) {
        if (logChannel) {
          logChannel = await prisma.channelPurpose.update({
            where: { id: logChannel.id },
            data: { discordId: logChannelInfo.id }
          });
        }
        else {
          logChannel = await prisma.channelPurpose.create({
            data: {
              serverId: server.id,
              channelType: ChannelPurposeType.BotLog,
              discordId: logChannelInfo.id
            }
          });
        }
      }
      if (logChannel) {
        message += `- Log channel: <#${logChannel.discordId}>\n`;
      }
      await databaseHelper.createServer(interaction.client, discordServer);
      console.log(message);
      await interaction.editReply(message);
      await writeToLogChannel(discordServer, server, message);
    }
    catch (error) {
      console.error(error);
      await interaction.editReply(errorMessage);
    }
  }
}