import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma, UserRoleType } from "@prisma/client";

const options = {
  game: 'game',
  guild: 'guild'
}

export default class GetGuildInfoCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('getguildinfo')
      .setDescription('Get guild info')
      .addIntegerOption(option =>
        option.setName(options.game)
          .setDescription('game guild is in')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(option =>
        option.setName(options.guild)
          .setDescription('guild to get information for')
          .setRequired(true)
          .setAutocomplete(true)
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
    const guildId = interaction.options.getInteger(options.guild)!;

    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);
      
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      const guild = await prisma.guild.findUniqueOrThrow({
        where: { id: guildId },
        include: { game: true }
      });
      
      const discordCaller = await discordServer.members.fetch(caller.discordId!);

      // check if server owner OR admin OR guild management
      const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: guild.serverId, roleType: UserRoleType.ServerOwner },
        { serverId: guild.serverId, roleType: UserRoleType.Administrator },
        { serverId: guild.serverId, roleType: UserRoleType.GuildManagement, guildId: guild.id }
      ]
      const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
      if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return;
      }

      let message = `**${guild.name}**\nGame: ${guild.game.name}\n`;
      
      const guildRoles = await prisma.userRole.findMany({ where: {
        serverId: server.id,
        guildId: guild.id,
      }});
      
      const managementRole = guildRoles.find(role => role.roleType === UserRoleType.GuildManagement)!;
      const discordManagementRole = await discordServer.roles.fetch(managementRole.discordId!);
      if (discordManagementRole) {
        message += `${discordManagementRole}: ${discordManagementRole.members.map(member => `${member}`).join(', ')}\n`;
      }
      
      const memberRole = guildRoles.find(role => role.roleType === UserRoleType.GuildMember)!;
      const discordMemberRole = await discordServer.roles.fetch(memberRole.discordId!);
      if (discordMemberRole) {
        message += `${discordMemberRole} (${discordMemberRole.members.size}) :\n${discordMemberRole.members.map(member => `- ${member}`).join('\n')}`;
      }

      await interaction.editReply(message);
    }
    catch (error) {
      console.error(error);
    }
  }

  override async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) return;
    const discordServer = interaction.guild;
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      const { prisma, databaseHelper } = await this.GetHelpers(interaction.user);
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      
      switch (focusedOption.name) {
        case options.game:
          const gameGuilds = await databaseHelper.getGameGuilds(server.id);
          await interaction.respond(
            gameGuilds.map(guild => ({ name: guild.game.name, value: guild.game.id }))
          );
          break;
        case options.guild:
          const gameId = interaction.options.getInteger(options.game)!;
          const guilds = await prisma.guild.findMany({
            where: {
              serverId: server.id,
              gameId: gameId,
              guildId: { not: '' }, // not shared guild
              active: true   
            }
          });
          await interaction.respond(
            guilds.map(guild => ({ name: guild.name, value: guild.id }))
          );
          break;
      }
    }
    catch (error) {
      console.log(error);
    }
  }
}