import { AutocompleteInteraction, BaseGuildTextChannel, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Guild, GuildApplicant, Prisma, PrismaClient, Server, User, UserRole } from "@prisma/client";
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
                    await acceptAction(interaction, user, guild, prisma, caller, databaseHelper, application);
                    break;
                case subcommands.decline:
                    await declineAction(interaction, server, prisma, caller, databaseHelper, application);
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
 * @param user The user to accept
 * @param guild The guild to be accepted into
 * @param prisma Prisma Client
 * @param caller The user who called this interaction
 * @param databaseHelper database helper
 * @param application The guild application if there is one
 * @returns The response to display to user
 */
const acceptAction = async function(
    interaction: ChatInputCommandInteraction,
    user: User,
    guild: Guild,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper,
    application: GuildApplicant | null
): Promise<boolean> {
    // check if server owner OR admin OR guild management
    let roles: Prisma.UserRoleWhereInput[] = [
        { serverId: guild.serverId, roleType: UserRoleType.ServerOwner },
        { serverId: guild.serverId, roleType: UserRoleType.Administrator },
        { serverId: guild.serverId, roleType: UserRoleType.GuildLead, guildId: guild.id },
        { serverId: guild.serverId, roleType: UserRoleType.GuildManagement, guildId: guild.id },
    ]
    let hasPermission = await databaseHelper.userHasPermission(caller.id, roles);
    if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return false;
    }
    // get current roles
    const currentRelations = await prisma.userRelation.findMany({ 
        where: { 
            user: user,
            role: { serverId: guild.serverId }
        },
        include: { role: { include: { guild: true } } }
    });

    // check if roles are new and need to be added
    const guildRole = await databaseHelper.getGuildRole(guild, UserRoleType.GuildMember);
    const sharedGuildRole = await databaseHelper.getSharedGuildRole(guild, UserRoleType.GuildMember);
    const rolesToAdd: UserRole[] = [];
    if (guildRole && currentRelations.findIndex(relation => relation.roleId === guildRole.id) < 0) {
        rolesToAdd.push(guildRole);
    }
    if (sharedGuildRole && currentRelations.findIndex(relation => relation.roleId === sharedGuildRole.id) < 0) {
        rolesToAdd.push(sharedGuildRole);
    }
    if (rolesToAdd.length > 0) {
        await prisma.userRelation.createMany( {
            data: rolesToAdd.map(role => { return { userId: user.id, roleId: role.id } })
        });
        if (user.discordId) {
            const discordUser = await interaction.guild!.members.fetch(user.discordId);
            discordUser.roles.add(rolesToAdd.filter(role => !!role.discordId).map(role => role.discordId!));
        }
    }
    if (application) {
        await prisma.guildApplicant.delete({
            where: { id: application.id },
        });
    }
    
    // check what guilds user is currently in so user can clean them up if need be
    const currentGuilds = currentRelations.filter(relation => {
        return relation.role.roleType === UserRoleType.GuildMember &&
            relation.role.id !== sharedGuildRole?.id &&
            relation.role.guild?.gameId === guild.gameId;
    });
    let message = `'${user.name}' was accepted into '${guild.name}'\n`;
    console.log(message);
    await interaction.editReply(message);
    if (currentGuilds.length > 0) {
        if (interaction.channel && interaction.channel instanceof BaseGuildTextChannel) {
            message += `Is this a guild transfer? Respond with Yes if you want to remove these other guild roles:\n`;
            for (let relation of currentGuilds) {
                message += `- <@&${relation.role.discordId}> for '${relation.role.guild!.name}'\n`;
            }
            await interaction.editReply(message);

            const confirmMessages = await interaction.channel.awaitMessages({
                filter: message => message.author.id === caller.discordId,
                max: 1,
                time: 10000,
            });
            const removeOldRoles = confirmMessages.first()!.content.toLowerCase();
            let followUpMessage = '';
            if (removeOldRoles === 'yes' || removeOldRoles === 'y') {
                await prisma.userRelation.deleteMany({ 
                    where: { OR: currentGuilds.map(relation => { return { id: relation.id } }) }
                });
                if (user.discordId) {
                    const discordUser = await interaction.guild!.members.fetch(user.discordId);
                    discordUser.roles.remove(currentGuilds.filter(relation => !!relation.role.discordId).map(relation => relation.role.discordId!));
                }
                followUpMessage = 'Old guild roles have been removed.';
            }
            else {
                followUpMessage = 'OK, user now belongs to multiple guilds.';
            }
            await interaction.followUp(followUpMessage);
        }
        else {
            message += `They are also already in these guilds (remove old roles if need be):\n`;
            for (let relation of currentGuilds) {
                message += `- <@&${relation.role.discordId}> for '${relation.role.guild!.name}'\n`;
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
 * @param application The guild application if there is one
 * @returns The response to display to user
 */
const declineAction = async function(
    interaction: ChatInputCommandInteraction,
    server: Server,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper,
    application: GuildApplicant | null
): Promise<boolean> {
    // check if server owner OR admin
    const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
        { serverId: server.id, roleType: UserRoleType.Administrator },
    ]
    const hasPermission = await databaseHelper.userHasPermission(caller.id, roles);
    if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return false;
    }
    if (!application) {
        interaction.editReply('There is no open application');
        return false;
    }
    await prisma.guildApplicant.delete({
        where: { id: application.id },
    });

    const message = 'Application was declined';
    console.log(message);
    await interaction.editReply(message);
    return true;
}
export = appActionCommands;

