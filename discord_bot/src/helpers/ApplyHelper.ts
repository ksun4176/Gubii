import { Guild, PrismaClient, Server, User } from "@prisma/client";
import { ChannelPurposeType, DatabaseHelper, UserRoleType } from "../DatabaseHelper";
import { BaseInteraction, Channel, ChannelType, Guild as DiscordServer, Message, PartialMessage } from "discord.js";
import { getChannelThread } from "./ChannelHelper";

/**
 * Apply to a guild.
 * @param interaction The discord interaction
 * @param server The server application is in
 * @param prisma Prisma Client
 * @param caller The user who called this interaction
 * @param databaseHelper database helper
 * @param guildId ID of guild to apply to
 * @param gameId ID of game to apply for. This is only used if guildId is not provided
 * @returns The response to display to user
 */
export const applyToGuild = async (
    interaction: BaseInteraction,
    server: Server,
    prisma: PrismaClient,
    caller: User,
    databaseHelper: DatabaseHelper,
    guildId?: number,
    gameId?: number
) => {
    if (!interaction.guild) {
        throw new Error('This command needs to be ran in a server');
    }
    let guild: Guild | null | undefined = null;
    if (guildId) {
        guild = await prisma.guild.findUnique({ where: { id: guildId } });
    }
    else {
        const gameGuilds = await databaseHelper.getGameGuilds(server.id);
        guild = gameGuilds.find(guild => guild.gameId === gameId);
    }

    if (!guild) {
        throw new Error('Game not supported in server');
    }

    // get management roles
    const managementRole = await prisma.userRole.findUniqueOrThrow({ where: {
        roleType_serverId_guildId: {
            roleType: UserRoleType.GuildManagement,
            serverId: server.id,
            guildId: guild.id
        }
    }});

    // find channels
    const recruitChannel = await databaseHelper.getGameChannel(guild, ChannelPurposeType.Recruitment);
    if (!recruitChannel) {
        throw new Error('Recruitment channel is not set up correctly');
    }
    const applicantChannel = await databaseHelper.getGameChannel(guild, ChannelPurposeType.Applicant);
    if (!applicantChannel) {
        throw new Error('Applicant channel is not set up correctly');
    }

    // get discord channels
    const discordServer = interaction.guild;
    const discordRecruitChannel = await discordServer.channels.fetch(recruitChannel.discordId);
    if (!discordRecruitChannel || discordRecruitChannel.type !== ChannelType.GuildText) {
        throw new Error('Recruitment channel is not set up correctly');
    }
    const discordApplicantChannel = await discordServer.channels.fetch(applicantChannel.discordId);
    if (!discordApplicantChannel || discordApplicantChannel.type !== ChannelType.GuildText) {
        throw new Error('Applicant channel is not set up correctly');
    }

    // get thread
    const recruitThread = await getChannelThread(discordRecruitChannel, caller);
    const applicantThread = await getChannelThread(discordApplicantChannel, caller);

    // apply to guild
    await prisma.guildApplicant.upsert({
        create: {
            userId: caller.id,
            guildId: guild.id,
            gameId: guild.gameId,
            serverId: server.id
        },
        where: {
            userId_gameId_serverId: {
                userId: caller.id,
                gameId: guild.gameId,
                serverId: server.id
            }
        },
        update: {
            guildId: guild.id
        }
    });

    // get guild application
    const gameGuild = await databaseHelper.getGameGuild(guild);
    const applicationText = await databaseHelper.getGuildApplication(server, gameGuild!, caller);

    // send messages
    const recruitChannelMessage = `<@${caller.discordId}> just applied for a guild. ${recruitThread} is their private application chat.`;
    await discordRecruitChannel.send(recruitChannelMessage);
    
    let recruitThreadMessage = `${caller.name} just applied for ${guild.name}!\nAdding <@&${managementRole.discordId}> to the thread.\n`;
    if (applicationText) {
        recruitThreadMessage += `\nHere is the app sent to the applicant:\n\`\`\`${applicationText.original}\`\`\``;
    }
    await recruitThread.send(recruitThreadMessage);

    let applicantThreadMessage = `Hi <@${caller.discordId}>!\nThank you for applying!\nWe will reach out here to talk about your application.\n`;
    if (applicationText) {
        applicantThreadMessage = applicationText.formatted;
    }
    await applicantThread.send(applicantThreadMessage);

    console.log(`${caller.name} applied to ${guild.name}`);
    return applicantThread;
}

/**
 * Look up information about a message that is going between a recruiter and a guild applicant.
 * This will return null if the message is deemed not to be a guild application message.
 * See getGuildApplyChannelInfo for more information.
 * @param prisma Prisma client to look up database info
 * @param databaseHelper Helper class for database handling
 * @param message message to look for information about
 * @returns See getGuildApplyChannelInfo
 */
export const getGuildApplyMessageInfo = async (prisma: PrismaClient, databaseHelper: DatabaseHelper, message: Message | PartialMessage) => {
    if (!message.inGuild()) {
        return null;
    }
    return await getGuildApplyChannelInfo(prisma, databaseHelper, message);
}

/**
 * Look up information about an interaction that happened in a recruitment/applicant thread.
 * See getGuildApplyChannelInfo for more information.
 * @param prisma Prisma client to look up database info
 * @param databaseHelper Helper class for database handling
 * @param message message to look for information about
 * @returns See getGuildApplyChannelInfo
 */
export const getGuildApplyInteractionInfo = async (prisma: PrismaClient, databaseHelper: DatabaseHelper, interaction: BaseInteraction) => {
    if (!interaction.guild) {
        return null;
    }
    return await getGuildApplyChannelInfo(prisma, databaseHelper, interaction);
}

/**
 * Look up information that is going between a recruiter and a guild applicant.
 * This will throw errors if guild application isn't set up correctly.
 * @param prisma Prisma client to look up database info
 * @param databaseHelper Helper class for database handling
 * @param data discord server and channel information
 * @returns 
 *  - application: the GuildApplicant object
 *  - sourceChannel: the ChannelPurpose object for where the message is coming from
 *  - targetChannel: the ChannelPurpose object for where the message should be forwarded to
 *  - targetThread: the actual thread under the targetChannel that we should forward the message to 
 */
const getGuildApplyChannelInfo = async (prisma: PrismaClient, databaseHelper: DatabaseHelper, data: { channel: Channel | null, guild: DiscordServer | null }) => {
    // only handling messages from threads: Recruitment + Applicant
    if (!data.channel || !data.channel.isThread() || !data.guild) {
        return null;
    }
    const threadParentId = data.channel.parentId;
    const threadName = data.channel.name;
    const applicantId = threadName.slice(threadName.indexOf('|')+1);
    if (!threadParentId || !applicantId) {
        return null;
    }


    // check if is recruitment/applicant channel and then get counterpart
    const sourceChannel = await prisma.channelPurpose.findFirst({
        where: { OR: [
            {
                discordId: threadParentId,
                channelType: ChannelPurposeType.Applicant
            },
            {
                discordId: threadParentId,
                channelType: ChannelPurposeType.Recruitment
            }
        ] },
        include: { guild: true }
    });
    if (!sourceChannel) {
        return null;
    }
    
    // find applicant
    const user = await prisma.user.findUnique({ where: { discordId: applicantId } });
    if (!user) {
        throw new Error('Applicant not found');
    }
    const application = await prisma.guildApplicant.findUnique({ 
        where: {
            userId_gameId_serverId: {
                userId: user.id,
                gameId: sourceChannel.guild!.gameId,
                serverId: sourceChannel.serverId
            }
        },
        include: { user: true }
    });

    const targetChannel = await databaseHelper.getGameChannel(
        sourceChannel.guild!, 
        sourceChannel.channelType === ChannelPurposeType.Applicant ? ChannelPurposeType.Recruitment : ChannelPurposeType.Applicant
    );
    if (!targetChannel) {
        throw new Error('Target channel not found');
    }
    const discordTargetChannel = await data.guild.channels.fetch(targetChannel.discordId);
    if (!discordTargetChannel || discordTargetChannel.type !== ChannelType.GuildText) {
        throw new Error('Target channel not set up correctly');
    }
    const targetThread = await getChannelThread(discordTargetChannel, user);
    return {
        application: application,
        sourceChannel: sourceChannel,
        targetChannel: targetChannel,
        discordTargetChannel: discordTargetChannel,
        targetThread: targetThread
    };
}