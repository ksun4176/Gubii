import { Events, GuildMember, PartialGuildMember } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { UserRoleType } from "../DatabaseHelper";
import { UserRole } from "@prisma/client";

const guildMemberUpdateEvent: EventInterface<Events.GuildMemberUpdate> = {
    name: Events.GuildMemberUpdate,
	async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
        const rolesRemoved = oldMember.roles.cache.subtract(newMember.roles.cache);
        const rolesAdded = newMember.roles.cache.subtract(oldMember.roles.cache);
        if(rolesRemoved.size === 0 && rolesAdded.size === 0) {
            return;
        }
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            
            // get user + server + current roles
            const user = await prisma.user.findUniqueOrThrow({ where: { discordId: newMember.id } });
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: newMember.guild.id } });
            const currentRelations = await prisma.userRelation.findMany({ 
                where: {
                    user: user,
                    role: { server: server }
                }
            });

            // remove roles
            let rolesCriteria = rolesRemoved.map(role => { return { discordId: role.id }; });
            let rolesToRemove = await prisma.userRole.findMany({ 
                where: { OR: rolesCriteria }
            });
            rolesToRemove = rolesToRemove.filter(role => currentRelations.findIndex(relation => relation.roleId === role.id) >= 0);
            if (rolesToRemove.length > 0) {
                await prisma.userRelation.deleteMany({ 
                    where: { 
                        user: user,
                        role: { OR: rolesToRemove }
                    }
                });
                console.log(`roles removed: ${rolesToRemove.map(role => role.id)}`);
            }

            // add roles
            rolesCriteria = rolesAdded.map(role => { return { discordId: role.id }; });
            let rolesToAdd = await prisma.userRole.findMany({ 
                where: { OR: rolesCriteria }
            });
            rolesToAdd = rolesToAdd.filter(role => currentRelations.findIndex(relation => relation.roleId === role.id) < 0);
            if (rolesToAdd.length > 0) {
                await prisma.userRelation.createMany( {
                    data: rolesToAdd.map(role => { return { userId: user.id, roleId: role.id } })
                });
                console.log(`roles added: ${rolesToAdd.map(role => role.id)}`);
            }

            if (rolesToRemove.length === 0 && rolesToAdd.length === 0) {
                return;
            }

            // find all guild roles user has and divide it into actual guilds + shared guilds
            const placeholderGuilds = await databaseHelper.getPlaceholderGuilds(server.id);
            const userGuildRelations = await prisma.userRelation.findMany({
                where: { 
                    user: user,
                    role: {
                        OR: [
                            UserRoleType.GuildLead,
                            UserRoleType.GuildManagement,
                            UserRoleType.GuildMember   
                        ].map(roleType => { return { roleType: roleType, server: server }; })
                    }
                },
                include: { role: { include: { guild: true } } }
            });
            const guildRoles = userGuildRelations.map(relation => relation.role);
            let sharedRoles: typeof guildRoles = [];
            let notSharedRoles: typeof guildRoles = [];
            for (let role of guildRoles) {
                if (placeholderGuilds.findIndex(guild => guild.id === role.guildId) >= 0) {
                    sharedRoles.push(role);
                }
                else {
                    notSharedRoles.push(role);
                }
            };

            // remove roles from shared guild
            const sharedRolesToRemove = sharedRoles.filter(role => {
                for (let nRole of notSharedRoles) {
                    if (nRole.roleType === role.roleType &&
                        nRole.guild?.gameId === role.guild?.gameId) {
                            return false;
                        }
                }
                return true;
            });
            if (sharedRolesToRemove.length > 0) {
                await prisma.userRelation.deleteMany({ 
                    where: { 
                        user: user,
                        role: { OR: sharedRolesToRemove }
                    }
                });
                newMember.roles.remove(sharedRolesToRemove.filter(role => !!role.discordId).map(role => role.discordId!));
            }

            // add roles from shared guild
            const sharedRolesToAdd: UserRole[] = [];
            for (let role of notSharedRoles) {
                const sharedRole = await databaseHelper.getSharedGuildRole(role.guild!, role.roleType!);
                // found shared role and user don't already have it
                if (sharedRole && sharedRoles.findIndex(sRole => sRole.id === sharedRole.id) < 0) {
                    sharedRolesToAdd.push(sharedRole);
                }
            }
            if (sharedRolesToAdd.length > 0) {
                await prisma.userRelation.createMany( {
                    data: sharedRolesToAdd.map(role => { return { userId: user.id, roleId: role.id } })
                });
                newMember.roles.add(sharedRolesToAdd.filter(role => !!role.discordId).map(role => role.discordId!));
            }
            
            const currentRelationsEnd = await prisma.userRelation.findMany({ 
                where: { 
                    user: user,
                    role: { server: server }
                }
            });
            console.log(`User ${user.name} now has these roles: ${currentRelationsEnd.map(relation => relation.roleId)}`);
        }
        catch (error) {
            console.error(error);
        }
    },
}

export = guildMemberUpdateEvent;