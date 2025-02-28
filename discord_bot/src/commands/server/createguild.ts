import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma, UserRoleType } from "@prisma/client";
import { writeToLogChannel } from "../../helpers/ChannelHelper";

const options = {
  game: 'game',
  ingameid: 'ingameid',
  name: 'name',
  managementrole: 'managementrole',
  memberrole: 'memberrole'
}

export default class CreateGuildCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('createguild')
      .setDescription('Create (or update) a guild in the server')
      .addIntegerOption(option =>
        option.setName(options.game)
          .setDescription('game guild is in')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option.setName(options.ingameid)
          .setDescription('ID in game')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName(options.name)
          .setDescription('name of guild')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option.setName(options.managementrole)
          .setDescription('role for guild management')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option.setName(options.memberrole)
          .setDescription('role for guild members')
          .setRequired(true)
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
    const inGameId = interaction.options.getString(options.ingameid)!;
    const name = interaction.options.getString(options.name)!;
    const managementRoleInfo = interaction.options.getRole(options.managementrole)!;
    const memberRoleInfo = interaction.options.getRole(options.memberrole)!;
    let errorMessage = 'There was an issue creating the guild.\n';
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

      // create guild object
      const guild = await prisma.guild.upsert({
        create: {
          name: name,
          serverId: server.id,
          gameId: gameId,
          guildId: inGameId
        },
        where: {
          gameId_guildId_serverId: {
            serverId: server.id,
            gameId: gameId,
            guildId: inGameId
          }
        },
        update: {
          active: true,
          name: name
        },
        include: {
          game: true
        }
      });
      let message = `### Guild Added\n` +
        `- ID: ${guild.id}\n` +
        `- Name: ${guild.name}\n` +
        `- Game: ${guild.game.name}\n`;
      
      try {
        const managementRole = await databaseHelper.createGuildRole(guild, UserRoleType.GuildManagement, managementRoleInfo);
        message += `- Management role: <@&${managementRole.discordId}>\n`;
      }
      catch (error) {
        errorMessage += `- Could not add management role. Has this role already been used?\n`;
        throw error;
      }
      try {
        const memberRole = await databaseHelper.createGuildRole(guild, UserRoleType.GuildMember, memberRoleInfo);
        message += `- Member role: <@&${memberRole.discordId}>\n`;
      }
      catch (error) {
        errorMessage += `- Could not add member role. Has this role already been used?\n`;
        throw error;
      }

      console.log(message);
      await interaction.editReply(message);
      await writeToLogChannel(discordServer, server, message);
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
    const discordServer = interaction.guild;
    
    try {
      const { databaseHelper } = await this.GetHelpers(interaction.user);
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      const gameGuilds = await databaseHelper.getGameGuilds(server.id);
      await interaction.respond(
        gameGuilds.map(guild => ({ name: guild.game.name, value: guild.game.id })),
      );
    }
    catch (error) {
        console.log(error);
    }
  }
}