import { Guild, Prisma, PrismaClient, Server, User } from "@prisma/client";
import { APIRole, Guild as DiscordServer, GuildMember, Role, User as DiscordUser } from "discord.js";

export enum ChannelPurposeType {
    Recruitment = 1,
    Applicant = 2,
    BotLog = 3
}

export enum UserRoleType {
    ServerOwner = 1,
    Administrator = 2,
    GuildLead = 3,
    GuildManagement = 4,
    GuildMember = 5
}

export enum ServerEvent {
    ServerMemberAdd = 1
}

export enum GuildEvent {
    Apply = 1,
    Accept = 2,
    Transfer = 3
}

export class DatabaseHelper {
    private __prisma: PrismaClient;
    
    constructor(prisma: PrismaClient) {
        this.__prisma = prisma;
    }

    //#region Server Helpers
    /**
     * Get whether a server handles a game.
     * @param serverId ID of server
     * @param gameId ID of game
     * @returns True if server handles a game, false otherwise
     */
    public async isGameInServer(serverId: number, gameId: number) {
        return !!(await this.__prisma.guild.findUnique({
            where: {
                gameId_guildId_serverId: {
                    serverId: serverId,
                    gameId: gameId,
                    guildId: '',
                },
                active: true
            }
        }));
    }

    /**
     * Create a ChannelPurpose object for the game
     * @param guild Original guild to see if there is a shared guild
     * @param channelType type to assign
     * @returns ChannelPurpose object
     */
    public async creatGameChannel(guild: Guild, channelType: ChannelPurposeType, channelDiscordId: string) {
        const gameGuild = await this.getGameGuild(guild);
        if (!gameGuild) {
            return null;
        }
        return await this.__prisma.channelPurpose.upsert({
            create: {
                serverId: gameGuild.serverId,
                guildId: gameGuild.id,
                channelType: channelType,
                discordId: channelDiscordId
            },
            where: {
                channelType_serverId_guildId: {
                    channelType: channelType,
                    serverId: gameGuild.serverId,
                    guildId: gameGuild.id,
                }
            },
            update: {
                discordId: channelDiscordId
            }
        });
    }

    /**
     * Get the channel for the game
     * @param guild Original guild to see if there is a shared guild
     * @param channelType channel type
     * @returns user role if found
     */
    public async getGameChannel(guild: Guild, channelType: ChannelPurposeType) {
        const gameGuild = await this.getGameGuild(guild);
        if (!gameGuild) {
            return null;
        }
        return await this.__prisma.channelPurpose.findUnique({ 
            where: {
                channelType_serverId_guildId: {
                    channelType: channelType,
                    serverId: gameGuild.serverId,
                    guildId: gameGuild.id,
                }
            }
        });
    }
    //#endregion Server Helpers
    
    //#region Guild Helpers
    /**
     * Create a placeholder guild for a game within a server.
     * This will be used when we need to link to a game within a server but not to a particular guild
     * @param gameId ID of game
     * @param serverId ID of server
     * @returns The created guild
     */
    public async createGameGuild(gameId: number, serverId: number) {
        const game = await this.__prisma.game.findUniqueOrThrow({ where: {id: gameId } });
        return await this.__prisma.guild.upsert({
            create: {
                name: game.name,
                serverId: serverId,
                gameId: game.id,
                guildId: ''
            },
            where: {
                gameId_guildId_serverId: {
                    serverId: serverId,
                    gameId: game.id,
                    guildId: ''
                }
            },
            update: {
                active: true,
            },
            include: {
                game: true
            }
        });
    }

    /**
     * Get the shared guild if its active
     * @param guild Original guild to see if there is a shared guild
     * @returns Game guild
     */
    public async getGameGuild(guild: Guild) {
        const gameGuild = await this.__prisma.guild.findUnique({
            where: {
                gameId_guildId_serverId: {
                    gameId: guild.gameId,
                    guildId: '',
                    serverId: guild.serverId
                },
                active: true
            }
        });
        return gameGuild;
    }

    /**
     * Get placeholder guilds within a server.
     * @param serverId ID of server
     * @returns Get active guilds in a server that say if a server handles a game
     */
    public async getGameGuilds(serverId: number) {
        return await this.__prisma.guild.findMany({
            where: {
                serverId: serverId,
                guildId: '',
                active: true
            },
            include: {
                game: true
            }
        });
    }
    
    /**
     * Create a UserRole object for the guild
     * @param guild guild information
     * @param roleType type to assign
     * @param roleInfo discord role information
     * @returns UserRole object
     */
    public async createGuildRole(guild: Guild, roleType: UserRoleType, roleInfo: Role | APIRole) {
        return await this.__prisma.userRole.upsert({
            create: {
                name: roleInfo.name,
                serverId: guild.serverId,
                guildId: guild.id,
                roleType: roleType,
                discordId: roleInfo.id
            },
            where: {
                roleType_serverId_guildId: {
                    roleType: roleType,
                    serverId: guild.serverId,
                    guildId: guild.id
                }
            },
            update: {
                name: roleInfo.name,
                discordId: roleInfo.id
            }
        });
    }

    /**
     * Get the user role for the guild
     * @param guild Guild to role for
     * @param roleType Role type
     * @returns user role if found
     */
    public async getGuildRole(guild: Guild, roleType: UserRoleType) {
        return await this.__prisma.userRole.findUnique({ 
            where: {
                roleType_serverId_guildId: {
                    roleType: roleType,
                    serverId: guild.serverId,
                    guildId: guild.id
                }
            }
        });
    }

    /**
     * Get the user role for the shared guild
     * @param guild Original guild to see if there is a shared guild
     * @param roleType Role type
     * @returns user role if found
     */
    public async getSharedGuildRole(guild: Guild, roleType: UserRoleType) {
        const gameGuild = await this.getGameGuild(guild);
        if (!gameGuild) {
            return null;
        }
        return await this.__prisma.userRole.findUnique({ 
            where: {
                roleType_serverId_guildId: {
                    roleType: roleType,
                    serverId: gameGuild.serverId,
                    guildId: gameGuild.id
                }
            }
        });
    }
    //#endregion Guild Helpers

    //#region User Helpers
    /**
     * Find or create a user
     * @param discordId Linked discord user
     * @param name name of user to save if creating
     * @returns found or created user
     */
    public async getUser(discordUser: DiscordUser) {
        const user = await this.__prisma.user.upsert({
            create: {
                name: discordUser.globalName ?? discordUser.username,
                discordId: discordUser.id
            },
            where: {
                discordId: discordUser.id
            },
            update: {
                name: discordUser.globalName ?? discordUser.username
            }
        });
        return user;
    }
    
    /**
     * Check if a user has ANY of the roles asked for.
     * This will determine if they have permission to do said action.
     * If the user is the server owner, this will automatically return true.
     * Otherwise if no roles provided, this will automatically return false.
     * Lastly, check the roles.
     * @param user the user to check
     * @param server the discord server
     * @param rolesCriteria roles to check
     * @returns true if user has permission, false otherwise
     */
    public async userHasPermission(user: GuildMember, server: DiscordServer, rolesCriteria: Prisma.UserRoleWhereInput[]) {
        // check if server owner
        const owner = await server.fetchOwner();
        if (owner.id === user.id) {
            return true;
        }
        let rolesRequired = await this.__prisma.userRole.findMany({ where: { OR: rolesCriteria } });
        rolesRequired = rolesRequired.filter(role => !!role.discordId);
        if (rolesRequired.length > 0) {
            return user.roles.cache.hasAny(...rolesRequired.map(role => role.discordId!));
        }
        return false;
    }
    //#endregion User Helpers

    //#region Channel Helpers
    /**
     * Write a message to the log channel if it exists.
     * @param discordServer the discord server
     * @param serverId the database server ID
     * @param message the message to write
     */
    public async writeToLogChannel(discordServer: DiscordServer, serverId: number, message: string) {
        try {
            let logChannel = await this.__prisma.channelPurpose.findFirst({
                where: {
                    serverId: serverId,
                    channelType: ChannelPurposeType.BotLog
                }
            });
            if (logChannel) {
                const discordLogChannel = await discordServer.channels.fetch(logChannel.discordId);
                if (discordLogChannel && discordLogChannel.isTextBased()) {
                    await discordLogChannel.send(message);
                }
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    //#endregion Channel Helpers

    //#region String formatting
    /**
     * Get the formatted guild application to be sent out.
     * @param server Server
     * @param gameGuild Guild of game
     * @param applicant Applicant
     * @returns the original + formatted application if it exists
     */
    public async getGuildApplication(server: Server, gameGuild: Guild, applicant: User) {
        const applicationText = await this.__prisma.guildMessage.findUnique({ where: {
            serverId_guildId_eventId: {
                serverId: server.id,
                guildId: gameGuild!.id,
                eventId: GuildEvent.Apply
            }
        }});
        if (!applicationText) {
            return null;
        }
        return {
            original: applicationText.text,
            formatted: `Hi <@${applicant.discordId}>!\nThank you for applying!\n\n**Can you fill out the application below?**\n\`\`\`${applicationText.text}\`\`\`\n`
        };
    }
    //#endregion String formatting
}