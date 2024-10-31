import { ChannelType, Events, GuildMember, PartialGuildMember } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { ServerEvent } from "../DatabaseHelper";

const guildMemberAddEvent: EventInterface<Events.GuildMemberAdd> = {
    name: Events.GuildMemberAdd,
	async execute(member: GuildMember | PartialGuildMember) {
        const serverInfo = member.guild;
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });
            await databaseHelper.getUser(member.user);

            const welcomeMessage = await prisma.serverMessage.findUnique({ where: {
                serverId_eventId: {
                    serverId: server.id,
                    eventId: ServerEvent.ServerMemberAdd
                }
            }});
            if (!welcomeMessage || !welcomeMessage.channelId) {
                return;
            }

            const discordChannel = await serverInfo.channels.fetch(welcomeMessage.channelId);
            if (!discordChannel || discordChannel.type !== ChannelType.GuildText) {
                return;
            }
            
            await discordChannel.send(welcomeMessage.text);
        }
        catch (error) {
            console.log(error);
        }
    }
}
export = guildMemberAddEvent;