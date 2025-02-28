import { ActionRowBuilder, AnyThreadChannel, AutocompleteInteraction, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, DiscordAPIError, RESTJSONErrorCodes, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { ChannelPurposeType, GuildEvent, Prisma, PrismaClient, User, UserRoleType } from "@prisma/client";
import { DatabaseHelper, ServerWithChannels } from "../../helpers/DatabaseHelper";
import { applyToGuild, getGuildApplyInteractionInfo } from "../../helpers/ApplyHelper";
import { writeToLogChannel } from "../../helpers/ChannelHelper";

const subcommands = {
  accept: 'accept',
  decline: 'decline',
  apply: 'apply'
}

const options = {
  game: 'game',
  guild: 'guild',
  user: 'user'
}

const buttons = {
  yesRemove: 'yesRemove',
  noRemove: 'noRemove'
}


export default class ApplicationCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('application')
      .setDescription('Actions you can take on an application')
      .addSubcommand(subcommand =>
        subcommand
          .setName(subcommands.accept)
          .setDescription('accept an application')
          .addIntegerOption(option =>
            option.setName(options.game)
              .setDescription('game application is for')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option.setName(options.guild)
              .setDescription('guild to accept into')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addUserOption(option =>
            option.setName(options.user)
              .setDescription('user to accept')
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName(subcommands.decline)
          .setDescription('decline an application')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName(subcommands.apply)
          .setDescription('apply to a guild')
          .addIntegerOption(option =>
            option.setName(options.game)
              .setDescription('game to apply for')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option.setName(options.guild)
              .setDescription('guild to specifically apply to')
              .setAutocomplete(true)
          )
      );
    super(CommandLevel.All, data);
  }
  
  override async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply('This command needs to be ran in a server');
      return;
    }
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);
      const server = await databaseHelper.getServer(interaction.client, interaction.guild);
      if (!server) return;
      switch (subcommand) {
        case subcommands.accept:
          await this.__acceptAction(interaction, server, prisma, caller, databaseHelper);
          break;
        case subcommands.decline:
          await this.__declineAction(interaction, server, prisma, caller, databaseHelper);
          break;
        case subcommands.apply:
          const gameId = interaction.options.getInteger(options.game)!;
          const guildId = interaction.options.getInteger(options.guild) ?? undefined;
          const applicantThread = await applyToGuild(interaction, server, prisma, caller, databaseHelper, guildId, gameId);
          await interaction.editReply(`You have successfully applied. Go to ${applicantThread} to go through your application.`);
          break;
        default:
          await interaction.editReply('No action done');
          break;
      }
    }
    catch (error) {
      console.error(error);
      await interaction.editReply('There was an issue taking this action.');
    }
  }

  override async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) {
      return;
    }
    const discordServer = interaction.guild;
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      const { prisma, databaseHelper } = await this.GetHelpers(interaction.user);
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      switch (focusedOption.name) {
        case options.game:
          let gameGuilds = await databaseHelper.getGameGuilds(server.id);
          const interactionInfo = await getGuildApplyInteractionInfo(prisma, databaseHelper, interaction);
          if (interactionInfo?.sourceChannel.channelType === ChannelPurposeType.Recruitment) {
            gameGuilds = gameGuilds.filter((guild) => guild.game.id === interactionInfo.sourceChannel.guild!.gameId);
          }
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

  /**
   * Accept a guild application.
   * This will also be used to transfer user between guilds.
   * @param interaction The discord interaction
   * @param server The server application is in
   * @param prisma Prisma Client
   * @param caller The user who called this interaction
   * @param databaseHelper database helper
   * @returns The response to display to user
   */
  private async __acceptAction(
    interaction: ChatInputCommandInteraction,
    server: ServerWithChannels,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper
  ) {
    const guildId = interaction.options.getInteger(options.guild)!;

    let user: User;
    let targetThread: AnyThreadChannel | null = null;
    const interactionInfo = await getGuildApplyInteractionInfo(prisma, databaseHelper, interaction);
    if (interactionInfo?.application) {
      user = interactionInfo.application.user;
      targetThread = interactionInfo.targetThread;
    }
    else {
      const userInfo = interaction.options.getUser(options.user);
      if (!userInfo) {
        interaction.editReply(`You need to specify the user.`)
        return false;
      }
      user = await databaseHelper.getUser(userInfo);
    }
    
    const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId } });
    const application = await prisma.guildApplicant.findUnique({
      where: {
        userId_gameId_serverId: {
          userId: user.id,
          gameId: guild.gameId,
          serverId: server.id
        }
      }
    });

    const discordServer = interaction.guild!;
    const discordCaller = await discordServer.members.fetch(caller.discordId!);
    const discordUser = await discordServer.members.fetch(user.discordId!);

    // check if server owner OR admin OR guild management
    let roles: Prisma.UserRoleWhereInput[] = [
      { serverId: guild.serverId, roleType: UserRoleType.ServerOwner },
      { serverId: guild.serverId, roleType: UserRoleType.Administrator },
      { serverId: guild.serverId, roleType: UserRoleType.GuildManagement, guildId: guild.id }
    ]
    const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
    if (!hasPermission) {
      interaction.editReply('You do not have permission to run this command');
      return false;
    }

    // check if roles are new and need to be added
    const guildRole = await databaseHelper.getGuildRole(guild, UserRoleType.GuildMember);
    try {
      if (guildRole?.discordId && !discordUser.roles.cache.has(guildRole.discordId)) {
        await discordUser.roles.add(guildRole.discordId);
      }
    }
    catch (error) {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) {
        await interaction.editReply(`Bot cannot assign role. Check Server Settings > Roles that its role is higher on the list`);
        return;
      }
      throw error;
    }
    if (application) {
      await prisma.guildApplicant.delete({ where: { id: application.id } });
    }
    let message = `'${user.name}' was accepted into '${guild.name}'\n`;
    console.log(message);
    await interaction.editReply(message);
    if (interactionInfo && interaction.channel!.isThread()) {
      await interaction.channel.setArchived(true);
    }
    if (targetThread) {
      await targetThread.send(`You have been accepted to ${guild.name}!`);
    }
    await writeToLogChannel(discordServer, server, message);
    
    // find what guilds user is currently in so user can clean them all up if need be
    let currentGuilds = await prisma.userRole.findMany({
      where: {
        id: { not: guildRole?.id }, // not guild to be added into
        roleType: UserRoleType.GuildMember,
        serverId: guild.serverId,
        guild: {
          guildId: { not: '' }, // not shared guild
          gameId: guild.gameId
        }
      },
      include: { guild: true }
    });
    currentGuilds = currentGuilds.filter(role => discordUser.roles.cache.has(role.discordId!)); // check that the user is in these guilds
    let transferred = false;
    if (currentGuilds.length > 0) {
      let followUpMessage = `Is this a guild transfer? If so, we will remove these old guild roles:\n`;
      for (let role of currentGuilds) {
        followUpMessage += `- <@&${role.discordId}> for '${role.guild!.name}'\n`;
      }

      const yesButton = new ButtonBuilder()
        .setCustomId(buttons.yesRemove)
        .setLabel('Yes')
        .setStyle(ButtonStyle.Primary);
      
      const noButton = new ButtonBuilder()
        .setCustomId(buttons.noRemove)
        .setLabel('No')
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(yesButton, noButton);
      
      const response = await interaction.followUp({
        content: followUpMessage,
        components: [actionRow]
      });

      try {
        const confirmation = await response.awaitMessageComponent({
          filter: i => i.user.id === interaction.user.id,
          time: 10000
        });

        if (confirmation.customId === buttons.noRemove) {
          await confirmation.update({ content: 'OK, user now belongs to multiple guilds.', components: [] });
        }
        else if (confirmation.customId === buttons.yesRemove) {
          await discordUser.roles.remove(currentGuilds.map(role => role.discordId!));
          await confirmation.update({ content: 'Old guild roles have been removed.', components: [] })
          transferred = true;
        }
      } 
      catch (error) {
        await response.edit({ content: 'Confirmation not received, old guild roles were kept...', components: [] });
      }
    }
    const gameGuild = await databaseHelper.getGameGuild(guild);
    const savedMessage = await prisma.guildMessage.findUnique({ where: {
      serverId_guildId_event: {
        serverId: server.id,
        guildId: gameGuild!.id,
        event: transferred ? GuildEvent.Transfer : GuildEvent.Accept
      }
    }});
    if (savedMessage?.channelId) {
      const discordChannel = await discordServer.channels.fetch(savedMessage.channelId);
      if (discordChannel?.isSendable()) {
        const messageInfo = await databaseHelper.replaceMessagePlaceholders(savedMessage.text, user, server, guild);
        await discordChannel.send(messageInfo.formatted);
      }
    }
    return true;
  }

  /**
  * Decline a guild application
  * @param interaction The discord interaction
  * @param server The server application is in
  * @param prisma Prisma Client
  * @param caller The user who called this interaction
  * @param databaseHelper database helper
  * @returns The response to display to user
  */
  private async __declineAction(
    interaction: ChatInputCommandInteraction,
    server: ServerWithChannels,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper,
  ): Promise<boolean> {
    // only handling this command from recruitment thread
    const interactionInfo = await getGuildApplyInteractionInfo(prisma, databaseHelper, interaction);
    if (!interactionInfo) {
      interaction.editReply('This command can only be ran within a recruitment thread.')
      return false;
    }
    const { application, sourceChannel, targetThread } = interactionInfo;
    if (sourceChannel.channelType !== ChannelPurposeType.Recruitment) {
      interaction.editReply('This command can only be ran within a recruitment thread.')
      return false;
    }
    
    const discordServer = interaction.guild!;
    const discordCaller = await discordServer.members.fetch(caller.discordId!);
    
    // check if server owner OR admin
    const roles: Prisma.UserRoleWhereInput[] = [
      { serverId: server.id, roleType: UserRoleType.ServerOwner },
      { serverId: server.id, roleType: UserRoleType.Administrator }
    ]
    const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
    if (!hasPermission) {
      interaction.editReply('You do not have permission to run this command');
      return false;
    }
    if (!application) {
      interaction.editReply('There is no open application');
      return false;
    }
    await prisma.guildApplicant.delete({ where: { id: application.id } });

    const message = `'${application.user.name}' was declined for '${sourceChannel.guild!.name}'`;
    console.log(message);
    await interaction.editReply(message);
    if (interactionInfo && interaction.channel!.isThread()) {
      await interaction.channel.setArchived(true);
    }
    await targetThread.send('This application was declined. Feel free to apply again in the future.');
    await writeToLogChannel(discordServer, server, message);
    return true;
  }
}