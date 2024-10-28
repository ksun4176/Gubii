import fs from "fs";
import path from "path";
import { AnyThreadChannel, ChannelType, Client, ClientEvents, Message, PartialMessage, TextChannel, ThreadAutoArchiveDuration } from "discord.js";
import { CommandInterface } from "./CommandInterface";
import { EventInterface } from "./EventInterface";
import { PrismaClient, User } from "@prisma/client";
import { ChannelPurposeType, DatabaseHelper } from "./DatabaseHelper";

/**
 * Find all commands and execute a callback on them
 * @param callbackFn the callback
 */
export const executeOnAllCommands = (callbackFn: (command: CommandInterface) => unknown) => {
    const foldersPath: string = path.join(__dirname, 'commands');
    const commandFolders: string[] = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath: string = path.join(foldersPath, folder);
        // look for commands in subdirectories
        if(fs.lstatSync(commandsPath).isDirectory()) {
            const commandFiles: string[] = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                executeOnCommand(filePath, callbackFn);
            }
        }
        else {
            executeOnCommand(commandsPath, callbackFn);
        }
    }
}

/**
 * Execute a callback at a command stored at the path.
 * This checks to make sure that the command is configured correctly.
 * @param commandFilePath file path to the command
 * @param callbackFn the callback
 */
const executeOnCommand = (commandFilePath: string, callbackFn: (command: CommandInterface) => unknown) => {
    const command: CommandInterface = require(commandFilePath);
    if ('data' in command && 'execute' in command) {
        callbackFn(command);
    } 
    else {
        console.log(`[WARNING] The command at ${commandFilePath} is missing a required "data" or "execute" property.`);
    }
}

/**
 * Add event listeners to a discord client
 * @param client Discord client to add event listeners to
 */
export const addEventListeners = (client: Client) => {
    const eventsPath: string = path.join(__dirname, 'events');
    const eventFiles: string[] = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath: string = path.join(eventsPath, file);
        const event: EventInterface<keyof ClientEvents> = require(filePath);
        if ('name' in event && 'execute' in event) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }
        else {
            console.log(`[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
        }
    }
}

/**
 * Find or create the thread in a discord channel that is linked to a user.
 * The format of the the thread's name will be in <Username>|<UserID>.
 * @param channel Channel to look in for thread
 * @param user User to find linked thread
 * @returns 
 */
export const getChannelThread = async (channel: TextChannel, user: User) => {
    const archiveManager = await channel.threads.fetchArchived({ type: 'private', fetchAll: true });
    const activeManager = await channel.threads.fetchActive();
    const threadsMap = new Map([...activeManager.threads, ...archiveManager.threads]);

    let thread: AnyThreadChannel | null = null;
    for (let [_, t] of threadsMap) {
        if (t.name.slice(t.name.indexOf('|')+1) === user.discordId) {
            thread = t;
            break;
        }
    }

    if (!thread) {
        thread = await channel.threads.create({
            name: `${user.name.replace('|','')}|${user.discordId}`,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            type: ChannelType.PrivateThread
        });
    }
    return thread;
}

/**
 * Look up information about a message that is going between a recruiter and a guild applicant.
 * This will return null if the message is deemed not to be a guild application message.
 * This will throw errors if guild application isn't set up correctly.
 * @param prisma Prisma client to look up database info
 * @param databaseHelper Helper class for database handling
 * @param message message to look for information about
 * @returns 
 *  - application: the GuildApplicant object
 *  - sourceChannel: the ChannelPurpose object for where the message is coming from
 *  - targetChannel: the ChannelPurpose object for where the message should be forwarded to
 *  - targetThread: the actual thread under the targetChannel that we should forward the message to 
 */
export const getGuildApplyMessageInfo = async (prisma: PrismaClient, databaseHelper: DatabaseHelper, message: Message | PartialMessage) => {
    if (!message.inGuild() || message.author.bot) {
        return null;
    }

    // only handling messages from threads: Recruitment + Applicant threads
    if (!message.channel.isThread()) {
        return null;
    }
    const threadParentId = message.channel.parentId;
    const threadName = message.channel.name;
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
    const application = await prisma.guildApplicant.findUniqueOrThrow({ 
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
    const discordTargetChannel = await message.guild.channels.fetch(targetChannel.discordId);
    if (!discordTargetChannel || discordTargetChannel.type !== ChannelType.GuildText) {
        throw new Error('Target channel not set up correctly');
    }
    const targetThread = await getChannelThread(discordTargetChannel, user);
    return {
        application: application,
        sourceChannel: sourceChannel,
        targetChannel: targetChannel,
        targetThread: targetThread
    };
}