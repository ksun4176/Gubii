import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, GuildMember, MessageCreateOptions, PartialGuildMember } from "discord.js";
import { EventInterface, GetEventInfo } from "../EventInterface";
import { ServerEvent } from "../DatabaseHelper";
import { Buttons } from "../buttons/ButtonInterface";

const guildMemberAddEvent: EventInterface<Events.GuildMemberAdd> = {
    name: Events.GuildMemberAdd,
	async execute(member: GuildMember | PartialGuildMember) {
        const serverInfo = member.guild;
        try {
            const { prisma, databaseHelper } = await GetEventInfo();
            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });
            const user = await databaseHelper.getUser(member.user);

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
            if (!discordChannel?.isSendable()) {
                return;
            }
            
            const messageInfo = await databaseHelper.replaceMessagePlaceholders(welcomeMessage.text, user, server);
            const message: MessageCreateOptions = {
                content: messageInfo.formatted
            }
            if (messageInfo.apply) {
                const applyButton = new ButtonBuilder()
                    .setCustomId(Buttons.GuildApply)
                    .setLabel('Apply to Guilds')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋');
                
                message.components = [new ActionRowBuilder<ButtonBuilder>().addComponents(applyButton)];
            }
            await discordChannel.send(message);
        }
        catch (error) {
            console.log(error);
        }
    }
}
export = guildMemberAddEvent;