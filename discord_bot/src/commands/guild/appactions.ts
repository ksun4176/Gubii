import { AutocompleteInteraction, BaseGuildTextChannel, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Guild, GuildApplicant, Prisma, PrismaClient, Server, User } from "@prisma/client";
import { DatabaseHelper, UserRoleType } from "../../DatabaseHelper";

const subcommands = {
    accept: 'accept',
    decline: 'decline'
}

const options = {
    game: 'game',
    guild: 'guild',
    user: 'user'
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
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName(subcommands.decline)
                .setDescription('decline an application')
                .addIntegerOption(option =>
                    option.setName(options.game)
                        .setDescription('game application is for')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addUserOption(option =>
                    option.setName(options.user)
                        .setDescription('user to decline')
                        .setRequired(true)
                )
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;

        const subcommand = interaction.options.getSubcommand();
        const gameId = interaction.options.getInteger(options.game)!;
        const userInfo = interaction.options.getUser(options.user)!;
        
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });
            const user = await prisma.user.findUniqueOrThrow({ where: {discordId: userInfo.id } });
            const application = await prisma.guildApplicant.findUnique({
                where: {
                    userId_gameId_serverId: {
                        userId: user.id,
                        gameId: gameId,
                        serverId: server.id
                    }
                }
            });
            switch (subcommand) {
                case subcommands.accept:
                    const guildId = interaction.options.getInteger(options.guild)!;
                    const guild = await prisma.guild.findUniqueOrThrow({ where: { id: guildId } });
                    await acceptAction(interaction, prisma, caller, databaseHelper, user, guild, application);
                    break;
                case subcommands.decline:
                    await declineAction(interaction, prisma, caller, databaseHelper, server, application);
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
                    const gameGuilds = await databaseHelper.getPlaceholderGuilds(server.id);
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
                            guildId: { not: '' },
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
 * @param prisma Prisma Client
 * @param caller The user who called this interaction
 * @param databaseHelper database helper
 * @param user The user to accept
 * @param guild The guild to be accepted into
 * @param application The guild application if there is one
 * @returns The response to display to user
 */
const acceptAction = async function(
    interaction: ChatInputCommandInteraction,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper,
    user: User,
    guild: Guild,
    application: GuildApplicant | null
): Promise<boolean> {
    const discordCaller = await interaction.guild!.members.fetch(caller.discordId!);
    const discordUser = await interaction.guild!.members.fetch(user.discordId!);
    // check if server owner OR admin OR guild management
    let roles: Prisma.UserRoleWhereInput[] = [
        { serverId: guild.serverId, roleType: UserRoleType.ServerOwner },
        { serverId: guild.serverId, roleType: UserRoleType.Administrator },
        { serverId: guild.serverId, roleType: UserRoleType.GuildLead, guildId: guild.id },
        { serverId: guild.serverId, roleType: UserRoleType.GuildManagement, guildId: guild.id }
    ]
    const hasPermission = await databaseHelper.userHasPermission(discordCaller, interaction.guild!, roles);
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
    databaseHelper.writeToLogChannel(interaction.guild!, guild.serverId, message);
    
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
            message += `Is this a guild transfer? Respond with Yes if you want to remove these other guild roles:\n`;
            for (let role of currentGuilds) {
                message += `- <@&${role.discordId}> for '${role.guild!.name}'\n`;
            }
            await interaction.editReply(message);

            let followUpMessage = '';
            try {
                const confirmMessages = await interaction.channel.awaitMessages({
                    filter: message => message.author.id === caller.discordId,
                    max: 1,
                    time: 10000,
                });
                const removeOldRoles = confirmMessages.first()!.content.toLowerCase();
                if (removeOldRoles === 'yes' || removeOldRoles === 'y') {
                    discordUser.roles.remove(currentGuilds.map(role => role.discordId!));
                    followUpMessage = 'Old guild roles have been removed.';
                }
                else {
                    followUpMessage = 'OK, user now belongs to multiple guilds.';
                }
            }
            catch (error) {
                console.log('No response received');
                followUpMessage = 'No response so old guild roles were kept';
            }
            await interaction.followUp(followUpMessage);
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
 * @param prisma Prisma Client
 * @param caller The user who called this interaction
 * @param databaseHelper database helper
 * @param server The server application is in
 * @param application The guild application if there is one
 * @returns The response to display to user
 */
const declineAction = async function(
    interaction: ChatInputCommandInteraction,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper,
    server: Server,
    application: GuildApplicant | null
): Promise<boolean> {
    const discordCaller = await interaction.guild!.members.fetch(caller.discordId!);
    // check if server owner OR admin
    const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
        { serverId: server.id, roleType: UserRoleType.Administrator }
    ]
    const hasPermission = await databaseHelper.userHasPermission(discordCaller, interaction.guild!, roles);
    if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return false;
    }
    if (!application) {
        interaction.editReply('There is no open application');
        return false;
    }
    await prisma.guildApplicant.delete({ where: { id: application.id } });

    const message = 'Application was declined';
    console.log(message);
    await interaction.editReply(message);
    databaseHelper.writeToLogChannel(interaction.guild!, server.id, message);
    return true;
}
export = appActionCommands;

