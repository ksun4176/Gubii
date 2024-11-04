import { PrismaClient } from '@prisma/client';
import { ClientEvents } from 'discord.js';
import { DatabaseHelper } from '../helpers/DatabaseHelper';

export abstract class BaseEvent<Event extends keyof ClientEvents> {
  constructor(private event: Event, private once?: boolean) { }

  getEvent() { return this.event; }
  getOnce() { return this.once; }

  abstract execute(...args: ClientEvents[Event]): Promise<void>;

  /**
   * Get information needed for all events
   * @returns PrismaClient to call database
   *          Some database helper functions
   */
  public async GetHelpers() {
    const prisma = new PrismaClient();
    const helper = new DatabaseHelper(prisma);
    return {
      prisma: prisma, 
      databaseHelper: helper 
    };
  }
}