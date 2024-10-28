import { Events, GuildMember, PartialGuildMember } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";

const guildMemberUpdateEvent: EventInterface<Events.GuildMemberRemove> = {
    name: Events.GuildMemberRemove,
	async execute(member: GuildMember | PartialGuildMember) {
        try {
            const { prisma } = await GetEventInfo();
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: member.guild.id } });
            const roles = await prisma.userRole.findMany({ where: { server: server } });
            const rolesToRemove: string[] = [];
            for (const role of roles) {
                if (role.discordId) {
                    rolesToRemove.push(role.discordId);
                }
            };
            if (rolesToRemove.length > 0) {
                member.roles.remove(rolesToRemove);
                console.log(`User ${member.user.username} left the server so we removed these roles: ${rolesToRemove}`);
            }
        }
        catch (error) {
            console.log(error);
        }
    }
}
export = guildMemberUpdateEvent;