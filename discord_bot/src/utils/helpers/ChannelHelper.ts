import { User } from "@prisma/client";
import { AnyThreadChannel, ChannelType, TextChannel, ThreadAutoArchiveDuration } from "discord.js";

/**
 * Find or create the thread in a discord channel that is linked to a user.
 * The format of the the thread's name will be in <Username>|<UserID>.
 * @param channel Channel to look in for thread
 * @param user User to find linked thread
 * @returns 
 */
export async function getChannelThread(channel: TextChannel, user: User) {
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