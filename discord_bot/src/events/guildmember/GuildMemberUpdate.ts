import { Events, GuildMember, PartialGuildMember } from "discord.js";
import { BaseEvent } from '../../utils/structures/BaseEvent';
import { UserRoleType } from "@prisma/client";
import { writeToLogChannel } from "../../helpers/ChannelHelper";

export default class GuildMemberUpdateEvent extends BaseEvent<Events.GuildMemberUpdate> {
  constructor() {
    super(Events.GuildMemberUpdate);
  }

  override async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
    const rolesChanged = newMember.roles.cache.difference(oldMember.roles.cache);
    if(rolesChanged.size === 0) {
      return;
    }
    try {
      await this.__updateSharedRoles(newMember);
    }
    catch (error) {
      console.error(error);
    }
  }

  /**
   * Update shared guild roles based on current roles
   * @param member Member Information
   */
  private async __updateSharedRoles(member: GuildMember) {
    const { prisma, databaseHelper } = await this.GetHelpers();
            
    // get server + guild roles
    const discordServer = member.guild;
    const server = await databaseHelper.getServer(discordServer.client, discordServer);
    if (!server) return;
    const user = await databaseHelper.getUser(member.user);
    const gameGuilds = await databaseHelper.getGameGuilds(server.id);
    const guildRoles = await prisma.userRole.findMany({
      where: { OR: [
        UserRoleType.GuildManagement,
        UserRoleType.GuildMember   
        ].map(roleType => { return { 
          roleType: roleType, 
          serverId: server.id,
        }; })
      },
      include: { guild: true }
    });
    const sharedRoles: string[] = [];
    // a map from gameId -> shared guild role type -> shared guild role ID
    const gameSharedRolesMap: Map<number, Map<UserRoleType, string>> = new Map();
    for (let role of guildRoles) {
      if (!role.discordId) {
        continue;
      }
      if (gameGuilds.findIndex(guild => guild.id === role.guildId) < 0) {
        continue;
      }
      const discordId = role.discordId;
      const gameId = role.guild!.gameId;
      sharedRoles.push(discordId);
      let mapToAdd: Map<UserRoleType, string>;
      if (gameSharedRolesMap.has(gameId)) {
        mapToAdd = gameSharedRolesMap.get(gameId)!;
      }
      else {
        mapToAdd = new Map();
        gameSharedRolesMap.set(gameId, mapToAdd);
      }
      mapToAdd.set(role.roleType!, discordId);
    };
    
    // a map from non-shared guild role ID -> shared guild role ID
    const guildRolesSharedMap: Map<string, string> = new Map();
    for (let role of guildRoles) {
      if (!role.discordId) {
        continue;
      }
      if (gameGuilds.findIndex(guild => guild.id === role.guildId) >= 0) {
        continue;
      }
      const discordId = role.discordId;
      const gameId = role.guild!.gameId;
      if (gameSharedRolesMap.has(gameId)) {
        const sharedRoleId = gameSharedRolesMap.get(gameId)!.get(role.roleType!);
        if (sharedRoleId) {
          guildRolesSharedMap.set(discordId, sharedRoleId);
        }
      }
    }

    const currentSharedRoles: Set<string> = new Set();
    const sharedRolesToHave: Set<string> = new Set();
    member.roles.cache.forEach((_, discordId) => {
      if (sharedRoles.indexOf(discordId) >= 0) {
        currentSharedRoles.add(discordId);
        return;
      }
      const sharedRoleId = guildRolesSharedMap.get(discordId);
      if (sharedRoleId) {
        sharedRolesToHave.add(sharedRoleId);
      }
    });

    const rolesToAdd: string[] = [];
    for (let roleId of sharedRolesToHave) {
      if (!currentSharedRoles.has(roleId)) {
        rolesToAdd.push(roleId);
      }
    }
    const rolesToRemove: string[] = [];
    for (let roleId of currentSharedRoles) {
      if (!sharedRolesToHave.has(roleId)) {
        rolesToRemove.push(roleId);
      }
    }
    try {
      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd);
        console.log(`User ${user.name} added these roles: ${rolesToAdd}`);
      }
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove);
        console.log(`User ${user.name} removed these roles: ${rolesToRemove}`);
      }
    }
    catch (error) {
      const errorMessage = `Bot cannot assign shared role. Check Server Settings > Roles that its role is higher on the list`;
      await writeToLogChannel(discordServer, server, errorMessage);
      throw error;
    }
  }
}