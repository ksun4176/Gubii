import { ChatInputCommandInteraction, PermissionFlagsBits, Role, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { ChannelPurposeType } from "@prisma/client";

export default class UpdateServerCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('getserverinfo')
      .setDescription('Get server info');
    super(CommandLevel.All, data);
  }
        
  override async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply('This command needs to be ran in a server');
      return;
    }
    await interaction.deferReply();
    const discordServer = interaction.guild;

    try {
      const { prisma, databaseHelper } = await this.GetHelpers(interaction.user);
      
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;

      let message = `**${server.name}**:\n`;

      const owner = await discordServer.fetchOwner();
      message += `- Owner: <@${owner.id}>\n`;

      const serverRoles = await discordServer.roles.fetch();
      const adminRoles: Role[] = [];
      serverRoles.forEach(role => {
        if (role.permissions.has(PermissionFlagsBits.Administrator, true)) {
          adminRoles.push(role);
        }
      });
      if (adminRoles.length > 0) {
        message += `- Admin roles: ${adminRoles.map(role => `<@&${role.id}>`).join(', ')}\n`;
      }

      const logChannel = server.channels.find(channel => channel.channelType === ChannelPurposeType.BotLog);
      if (logChannel) {
        message += `- Log channel: <#${logChannel.discordId}>\n`;
      }

      const gameGuilds = await databaseHelper.getGameGuilds(server.id);
      const activeGuilds = await prisma.guild.findMany({
        where: {
          serverId: server.id,
          game: { OR: gameGuilds.map(guild => { return { id: guild.gameId}; }) },
          guildId: { not: ''},
          active: true
        }
      });
      const guildsMap: Map<number, typeof activeGuilds> = new Map();
      for (const guild of activeGuilds) {
        if (!guildsMap.has(guild.gameId)) {
          guildsMap.set(guild.gameId, []);
        }
        const guilds = guildsMap.get(guild.gameId)!;
        guilds.push(guild);
      }
      message += `- Games played here:\n`
      for (const gameGuild of gameGuilds) {
        const guilds = guildsMap.get(gameGuild.gameId);
        if (guilds) {
          message += `  - **${gameGuild.game.name}** (${guilds.length}) : ${guilds.map(guild => guild.name).join(', ')}\n`;
        }
        else {
          message += `  - **${gameGuild.game.name}** (0)\n`;
        }
      }

      await interaction.editReply(message);
    }
    catch (error) {
      console.error(error);
    }
  }
}