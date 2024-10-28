import { Events, GuildMember, PartialGuildMember } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";

const guildMemberRemoveEvent: EventInterface<Events.GuildMemberRemove> = {
    name: Events.GuildMemberRemove,
	async execute(member: GuildMember | PartialGuildMember) {
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: member.guild.id } });
            const user = await databaseHelper.getUser(member.user);
            const roles = await prisma.userRole.findMany({ where: { server: server } });
            const rolesToRemove: string[] = [];
            for (const role of roles) {
                if (role.discordId) {
                    rolesToRemove.push(role.discordId);
                }
            };
            if (rolesToRemove.length > 0) {
                member.roles.remove(rolesToRemove);
                console.log(`User ${user.name} left the server so we removed these roles: ${rolesToRemove}`);
            }
        }
        catch (error) {
            console.log(error);
        }
    }
}
export = guildMemberRemoveEvent;