import { Events, GuildMember, PartialGuildMember } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { UserRoleType } from "../DatabaseHelper";

const guildMemberUpdateEvent: EventInterface<Events.GuildMemberUpdate> = {
    name: Events.GuildMemberUpdate,
	async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
        const rolesChanged = newMember.roles.cache.difference(oldMember.roles.cache);
        if(rolesChanged.size === 0) {
            return;
        }
        try {
            updateSharedRoles(newMember);
        }
        catch (error) {
            console.error(error);
        }
    },
}

/**
 * Update shared guild roles based on current roles
 * @param member Member Information
 */
const updateSharedRoles = async (member: GuildMember) => {
    const { prisma, databaseHelper } = await GetEventInfo();
            
    // get server + guild roles
    const server = await prisma.server.findUniqueOrThrow({ where: { discordId: member.guild.id } });
    const user = await databaseHelper.getUser(member.user);
    const gameGuilds = await databaseHelper.getGameGuilds(server.id);
    const guildRoles = await prisma.userRole.findMany({
        where: { OR: [
            UserRoleType.GuildLead,
            UserRoleType.GuildManagement,
            UserRoleType.GuildMember   
            ].map(roleType => { return { 
                roleType: roleType, 
                server: server,
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
    if (rolesToAdd.length > 0) {
        member.roles.add(rolesToAdd);
        console.log(`User ${user.name} added these roles: ${rolesToAdd}`);
    }
    const rolesToRemove: string[] = [];
    for (let roleId of currentSharedRoles) {
        if (!sharedRolesToHave.has(roleId)) {
            rolesToRemove.push(roleId);
        }
    }
    if (rolesToRemove.length > 0) {
        member.roles.remove(rolesToRemove);
        console.log(`User ${user.name} removed these roles: ${rolesToRemove}`);
    }
}

export = guildMemberUpdateEvent;