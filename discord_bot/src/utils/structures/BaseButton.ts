import { PrismaClient } from '@prisma/client';
import { ButtonInteraction, User } from 'discord.js';
import { DatabaseHelper } from '../../helpers/DatabaseHelper';

export abstract class BaseButton {
  constructor(private customId: string) {}

  /**
   * Get the custom ID for this button
   * @returns Custom ID of button
   */
  getCustomId() { return this.customId; }

  /**
   * Execute the button interaction
   * @param interaction Interaction that triggered the execute
   */
  abstract execute(interaction: ButtonInteraction): Promise<void>;

  /**
   * Get information needed for any button interaction
   * @returns PrismaClient to call database
   *          Created user object for caller
   *          Some database helper functions
   */
  public async GetHelpers(callerInfo: User) {
    const prisma = new PrismaClient();
    const helper = new DatabaseHelper(prisma);
    const caller = await helper.getUser(callerInfo);
    return {
      prisma: prisma, 
      caller: caller,
      databaseHelper: helper 
    };
  }
}