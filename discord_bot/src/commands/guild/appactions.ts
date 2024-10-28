import { ActionRowBuilder, AnyThreadChannel, AutocompleteInteraction, BaseGuildTextChannel, ButtonBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Guild, Prisma, PrismaClient, Server, User } from "@prisma/client";
import { ChannelPurposeType, DatabaseHelper, UserRoleType } from "../../DatabaseHelper";
import { getChannelThread, getGuildApplyInteractionInfo } from "../../DiscordHelper";

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

const appActionCommands: CommandInterface = {
    data: new SlashCommandBuilder()
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
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: interaction.guild.id } });
            switch (subcommand) {
                case subcommands.accept:
                    await acceptAction(interaction, server, prisma, caller, databaseHelper);
                    break;
                case subcommands.decline:
                    await declineAction(interaction, server, prisma, caller, databaseHelper);
                    break;
                case subcommands.apply:
                    await applyAction(interaction, server, prisma, caller, databaseHelper);
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
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.guild) {
            return;
        }
        const serverInfo = interaction.guild;
        const focusedOption = interaction.options.getFocused(true);
        
        try {
            const { prisma, databaseHelper } = await GetCommandInfo(interaction.user);
            const server = await prisma.server.findUniqueOrThrow({ where: {discordId: serverInfo.id } });
            
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
                            server: server,
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
    },
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
const acceptAction = async function(
    interaction: ChatInputCommandInteraction,
    server: Server,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper
): Promise<boolean> {
    const gameId = interaction.options.getInteger(options.game)!;
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
        user = await prisma.user.findUniqueOrThrow({ where: {discordId: userInfo.id } });
    }
    
    const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId } });
    const application = await prisma.guildApplicant.findUnique({
        where: {
            userId_gameId_serverId: {
                userId: user.id,
                gameId: gameId,
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
        { serverId: guild.serverId, roleType: UserRoleType.GuildLead, guildId: guild.id },
        { serverId: guild.serverId, roleType: UserRoleType.GuildManagement, guildId: guild.id }
    ]
    const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
    if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return false;
    }

    // check if roles are new and need to be added
    const guildRole = await databaseHelper.getGuildRole(guild, UserRoleType.GuildMember);
    if (guildRole?.discordId && !discordUser.roles.cache.has(guildRole.discordId)) {
        discordUser.roles.add(guildRole.discordId);
    }
    if (application) {
        await prisma.guildApplicant.delete({ where: { id: application.id } });
    }
    let message = `'${user.name}' was accepted into '${guild.name}'\n`;
    console.log(message);
    await interaction.editReply(message);
    if (targetThread) {
        await targetThread.send(`You have been accepted to ${guild.name}!`);
    }
    await databaseHelper.writeToLogChannel(discordServer, guild.serverId, message);
    
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
    if (currentGuilds.length > 0) {
        if (interaction.channel && interaction.channel instanceof BaseGuildTextChannel) {
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
                    discordUser.roles.remove(currentGuilds.map(role => role.discordId!));
                    await confirmation.update({ content: 'Old guild roles have been removed.', components: [] })
                }
            } 
            catch (error) {
                await response.edit({ content: 'Confirmation not received, old guild roles were kept...', components: [] });
            }
        }
        else {
            message += `They are also already in these guilds (remove old roles if need be):\n`;
            for (let role of currentGuilds) {
                message += `- <@&${role.discordId}> for '${role.guild!.name}'\n`;
            }
            await interaction.editReply(message);
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
const declineAction = async function(
    interaction: ChatInputCommandInteraction,
    server: Server,
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

    const message = `${application.user.name}'s application for ${sourceChannel.guild!.name} was declined.`;
    console.log(message);
    await interaction.editReply(message);
    await targetThread.send('This application was declined. Feel free to apply again in the future.');
    await databaseHelper.writeToLogChannel(discordServer, server.id, message);
    return true;
}

/**
 * Apply to a guild.
 * @param interaction The discord interaction
 * @param server The server application is in
 * @param prisma Prisma Client
 * @param caller The user who called this interaction
 * @param databaseHelper database helper
 * @returns The response to display to user
 */
const applyAction = async function(
    interaction: ChatInputCommandInteraction,
    server: Server,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper
): Promise<boolean> {
    const gameId = interaction.options.getInteger(options.game)!;
    let guildId = interaction.options.getInteger(options.guild);

    let guild: Guild | null | undefined = null;
    if (guildId) {
        guild = await prisma.guild.findUnique({ where: { id: guildId } });
    }
    else {
        const gameGuilds = await databaseHelper.getGameGuilds(server.id);
        guild = gameGuilds.find(guild => guild.gameId = gameId);
    }

    if (!guild) {
        throw new Error('Game not supported in server');
    }

    // get management roles
    const managementRoles = await prisma.userRole.findMany({ where: { OR: [
        {
            roleType: UserRoleType.GuildLead,
            server: server,
            guild: guild
        },
        {
            roleType: UserRoleType.GuildManagement,
            server: server,
            guild: guild
        }
    ] } });

    // find channels
    const recruitChannel = await databaseHelper.getGameChannel(guild, ChannelPurposeType.Recruitment);
    if (!recruitChannel) {
        throw new Error('Recruitment channel is not set up correctly');
    }
    const applicantChannel = await databaseHelper.getGameChannel(guild, ChannelPurposeType.Applicant);
    if (!applicantChannel) {
        throw new Error('Applicant channel is not set up correctly');
    }

    // get discord channels
    const discordServer = interaction.guild!;
    const discordRecruitChannel = await discordServer.channels.fetch(recruitChannel.discordId);
    if (!discordRecruitChannel || discordRecruitChannel.type !== ChannelType.GuildText) {
        throw new Error('Recruitment channel is not set up correctly');
    }
    const discordApplicantChannel = await discordServer.channels.fetch(applicantChannel.discordId);
    if (!discordApplicantChannel || discordApplicantChannel.type !== ChannelType.GuildText) {
        throw new Error('Applicant channel is not set up correctly');
    }

    // get thread
    const recruitThread = await getChannelThread(discordRecruitChannel, caller);
    const applicantThread = await getChannelThread(discordApplicantChannel, caller);

    // apply to guild
    await prisma.guildApplicant.upsert({
        create: {
            userId: caller.id,
            guildId: guild.id,
            gameId: gameId,
            serverId: server.id
        },
        where: {
            userId_gameId_serverId: {
                userId: caller.id,
                gameId: gameId,
                serverId: server.id
            }
        },
        update: {
            guildId: guild.id
        }
    });

    // send messages
    const recruitChannelMessage = `<@${caller.discordId}> just applied for a guild. <#${recruitThread.id}> is their private application chat.`;
    const recruitThreadMessage = `${caller.name} just applied for ${guild.name}!\nAdding ${managementRoles.map(role => `<@&${role.discordId}>`).join(', ')} to the thread.`;
    const applicantThreadMessage = `Hi <@${caller.discordId}>!\nThank you for applying! You can talk about your application in this thread.`;
    await discordRecruitChannel.send(recruitChannelMessage);
    await recruitThread.send(recruitThreadMessage);
    await applicantThread.send(applicantThreadMessage);

    console.log(`${caller.name} applied to ${guildId}`);
    await interaction.editReply(`You have successfully applied`);
    return true;
}
export = appActionCommands;