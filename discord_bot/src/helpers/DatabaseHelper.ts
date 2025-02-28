import { ChannelPurposeType, Guild, GuildEvent, Prisma, PrismaClient, Server, User, UserRoleType } from "@prisma/client";
import { APIRole, Guild as DiscordServer, GuildMember, Role, User as DiscordUser, PermissionFlagsBits, Client } from "discord.js";

const serverInclude = Prisma.validator<Prisma.ServerInclude>()({
  channels: true,
});

export type ServerWithChannels = Prisma.ServerGetPayload<{
  include: typeof serverInclude;
}>;


export class DatabaseHelper {
  private __prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
      this.__prisma = prisma;
  }

  //#region Server Helpers
  /**
   * Create a server object or update existing one 
   * @param client Discord bot client
   * @param discordServer Discord Server information
   * @returns The created DB server object
   */
  public async createServer(client: Client, discordServer: DiscordServer) {
    const server = await this.__prisma.server.upsert({
      create: {
        name: discordServer.name,
        discordId: discordServer.id,
      },
      where: {
        discordId: discordServer.id
      },
      update: {
        name: discordServer.name,
      },
      include: serverInclude
    });
    if (server.active) {
      client.servers.set(discordServer.id, server);
      return server;
    }
    return null;
  }

  /**
   * Get the server object 
   * @param client Discord bot client
   * @param discordServer Discord Server information
   * @returns The DB server object
   */
  public async getServer(client: Client, discordServer: DiscordServer) {
    let server: ServerWithChannels | null | undefined;
    if (client.servers.has(discordServer.id)) {
      server = client.servers.get(discordServer.id);
    }
    if (!server) {
      server =  await this.__prisma.server.findUnique({
        where: {
          discordId: discordServer.id
        },
        include: serverInclude
      });
    }
    if (!server) {
      server = await this.__prisma.server.create({
        data: {
          name: discordServer.name,
          discordId: discordServer.id
        },
        include: serverInclude
      });
    }
    if (server.active) {
      client.servers.set(discordServer.id, server);
      return server;
    }
    return null;
  }
  
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
  public async createGameChannel(guild: Guild, channelType: ChannelPurposeType, channelDiscordId: string) {
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
    for (let criterion of rolesCriteria) {
      if (criterion.serverId === server.id && criterion.roleType === UserRoleType.Administrator) {
        if (user.permissions.has(PermissionFlagsBits.Administrator, true)) {
          return true;
        }
        break;
      }
    }
    let rolesRequired = await this.__prisma.userRole.findMany({ where: { OR: rolesCriteria } });
    rolesRequired = rolesRequired.filter(role => !!role.discordId);
    if (rolesRequired.length > 0) {
      return user.roles.cache.hasAny(...rolesRequired.map(role => role.discordId!));
    }
    return false;
  }
  //#endregion User Helpers


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
      serverId_guildId_event: {
        serverId: server.id,
        guildId: gameGuild!.id,
        event: GuildEvent.Apply
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

  /**
   * Replace placeholders in the message and extract if there are any special actions to add to the message
   * @param content content to replace placeholders
   * @param user user context
   * @param server server context
   * @param guild guild context
   * @returns formatted message and any special actions to add to the message
   */
  public async replaceMessagePlaceholders(content: string, user?: User, server?: Server, guild?: Guild) {
    let formattedText = content;
    if (user) {
      formattedText = formattedText.replace(/\<\{user\}\>/g, `<@${user.discordId}>`);
    }
    
    if (server) {
      formattedText = formattedText.replace(/\<\{serverName\}\>/g, server.name);

      const adminRole = await this.__prisma.userRole.findFirst({ where: {
        roleType: UserRoleType.Administrator,
        serverId: server.id,
      }});
      if (adminRole) {
        formattedText = formattedText.replace(/\<\{serverAdmin\}\>/g, `<@&${adminRole.discordId}>`);
      }
    }
    if (guild) {
      formattedText = formattedText.replace(/\<\{guildName\}\>/g, `${guild.name + (guild.guildId === '' ? ' Guild' : '')}`);
      
      const game = await this.__prisma.game.findUnique({ where: { id: guild.gameId } });
      formattedText = formattedText.replace(/\<\{gameName\}\>/g, `${game!.name}`);

      const guildRoles = await this.__prisma.userRole.findMany({ where: { OR: [
        {
          roleType: UserRoleType.GuildManagement,
          serverId: guild.serverId,
          guildId: guild.id,
        },
        {
          roleType: UserRoleType.GuildMember,
          serverId: guild.serverId,
          guildId: guild.id,
        }
      ]}});
      formattedText = formattedText.replace(/\<\{guildManagement\}\>/g, guildRoles.filter(role => role.roleType === UserRoleType.GuildManagement).map(role => `<@&${role.discordId}>`).join(' '));
      formattedText = formattedText.replace(/\<\{guildMembers\}\>/g, guildRoles.filter(role => role.roleType === UserRoleType.GuildMember).map(role => `<@&${role.discordId}>`).join(' '));
    }

    const addApply = formattedText.indexOf('[|apply|]') >= 0;
    if (addApply) {
      formattedText = formattedText.replace(/\[\|apply\|\]/g, ``);
    }

    return {
      formatted: formattedText,
      apply: addApply
    }
  }
  //#endregion String formatting
}