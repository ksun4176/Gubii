import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma } from "@prisma/client";
import { ChannelPurposeType, UserRoleType } from "../../helpers/DatabaseHelper";

const options = {
  game: 'game',
  managementrole: 'managementrole',
  memberrole: 'memberrole',
  channelscategory: 'channelscategory',
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
    const serverInfo = interaction.guild;

    const gameId = interaction.options.getInteger(options.game)!;
    const managementRoleInfo = interaction.options.getRole(options.managementrole)!;
    const memberRoleInfo = interaction.options.getRole(options.memberrole)!;
    const channelsCategoryInfo = interaction.options.getChannel(options.channelscategory);
    let errorMessage = 'There was an issue adding support for the game.\n';
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

      const recruitChannelInfo = await interaction.guild.channels.create({
        name: `${gameGuild.name} recruitment`,
        topic: `Recruitment channel for ${gameGuild.name}`,
        type: ChannelType.GuildText,
        parent: channelsCategoryInfo?.id,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          { 
            id: managementRoleInfo.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.UseApplicationCommands]
          }
        ],
      });
      const recruitThread = await databaseHelper.createGameChannel(gameGuild, ChannelPurposeType.Recruitment, recruitChannelInfo.id);
      message += `- Recruitment thread: <#${recruitThread!.discordId}>\n`;

      const applicantChannelInfo = await interaction.guild.channels.create({
        name: `${gameGuild.name} applicants`,
        topic: `Applicants channel for ${gameGuild.name}`,
        type: ChannelType.GuildText,
        parent: channelsCategoryInfo?.id,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            allow: [PermissionFlagsBits.SendMessagesInThreads],
          }
        ],
      });
      const applicantChannel = await databaseHelper.createGameChannel(gameGuild, ChannelPurposeType.Applicant, applicantChannelInfo.id);
      message += `- Applicant thread: <#${applicantChannel!.discordId}>\n`;

      console.log(message);
      message += `You can now call /createguild to add guilds for this game.\n **(Recommended)** You can also call /addgametriggers to set up the application for the game`
      await interaction.editReply(message);
      await databaseHelper.writeToLogChannel(interaction.guild, server.id, message);
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