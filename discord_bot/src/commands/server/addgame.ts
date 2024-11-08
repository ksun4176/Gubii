import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { ChannelPurposeType, Prisma, UserRoleType } from "@prisma/client";
import { writeToLogChannel } from "../../helpers/ChannelHelper";

const options = {
  game: 'game',
  managementrole: 'managementrole',
  memberrole: 'memberrole',
  channelscategory: 'channelscategory',
  recruitchannel: 'recruitchannel',
  applicantchannel: 'applicantchannel'
}

export default class AddGameCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('addgame')
      .setDescription('Add a game to the server. This will create the recruitment and applicant thread channels')
      .addIntegerOption(option => 
        option.setName(options.game)
          .setDescription('game to add to server')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addRoleOption(option =>
        option.setName(options.managementrole)
          .setDescription('shared role for all guild management for the game')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option.setName(options.memberrole)
          .setDescription('shared role for all guild members for the game')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option.setName(options.channelscategory)
          .setDescription('category to create recruitment and applicant thread channels in')
          .addChannelTypes(ChannelType.GuildCategory)
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

    const gameId = interaction.options.getInteger(options.game)!;
    const managementRoleInfo = interaction.options.getRole(options.managementrole)!;
    const memberRoleInfo = interaction.options.getRole(options.memberrole)!;
    const channelsCategoryInfo = interaction.options.getChannel(options.channelscategory);
    let errorMessage = 'There was an issue adding support for the game.\n';
    try {
      const { caller, databaseHelper } = await this.GetHelpers(interaction.user);

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

      const gameGuild = await databaseHelper.createGameGuild(gameId, server.id);

      let message = `Game '${gameGuild.name}' is added to the server '${server.name}'\n`;
      try {
        const managementRole = await databaseHelper.createGuildRole(gameGuild, UserRoleType.GuildManagement, managementRoleInfo);
        message += `- Management role: <@&${managementRole.discordId}>\n`;
      }
      catch (error) {
        errorMessage += `- Could not add management role. Has this role already been used?\n`;
        throw error;
      }
      try {
        const memberRole = await databaseHelper.createGuildRole(gameGuild, UserRoleType.GuildMember, memberRoleInfo);
        message += `- Member role: <@&${memberRole.discordId}>\n`;
      }
      catch (error) {
        errorMessage += `- Could not add member role. Has this role already been used?\n`;
        throw error;
      }

      const recruitChannel = await discordServer.channels.create({
        name: `${gameGuild.name} recruitment`,
        topic: `Recruitment channel for ${gameGuild.name}`,
        type: ChannelType.GuildText,
        parent: channelsCategoryInfo?.id,
        permissionOverwrites: [
          {
            id: discordServer.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          { 
            id: managementRoleInfo.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.UseApplicationCommands]
          }
        ],
      });
      const recruitThread = await databaseHelper.createGameChannel(gameGuild, ChannelPurposeType.Recruitment, recruitChannel.id);
      message += `- Recruitment thread: <#${recruitThread!.discordId}>\n`;

      const applicantChannel = await discordServer.channels.create({
        name: `${gameGuild.name} applicants`,
        topic: `Applicants channel for ${gameGuild.name}`,
        type: ChannelType.GuildText,
        parent: channelsCategoryInfo?.id,
        permissionOverwrites: [
          {
            id: discordServer.roles.everyone,
            allow: [PermissionFlagsBits.SendMessagesInThreads],
          }
        ],
      });
      const applicantThread = await databaseHelper.createGameChannel(gameGuild, ChannelPurposeType.Applicant, applicantChannel.id);
      message += `- Applicant thread: <#${applicantThread!.discordId}>\n`;

      console.log(message);
      message += `You can now call /createguild to add guilds for this game.\n **(Recommended)** You can also call /addgametriggers to set up the application for the game`
      await interaction.editReply(message);
      await writeToLogChannel(discordServer, server, message);
    }
    catch (error) {
      console.error(error);
      await interaction.editReply(errorMessage);
    }
  }

  override async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const { prisma } = await this.GetHelpers(interaction.user);
      const games = await prisma.game.findMany();
      await interaction.respond(
        games.map(game => ({ name: game.name, value: game.id })),
      );
    }
    catch (error) {
      console.log(error);
    }
  }
}