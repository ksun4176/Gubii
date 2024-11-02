import { PrismaClient } from "@prisma/client";
import { ButtonInteraction, User } from "discord.js";
import { DatabaseHelper } from "../DatabaseHelper";

export const Buttons = {
    GuildApply: 'guildApply'
}

/**
 * Interface for individual button interactions.
 */
export interface ButtonInterface {
    execute: (interaction: ButtonInteraction) => Promise<void>;
}

/**
 * Get information needed for all buttons
 * @param callerInfo information on caller of button
 * @returns PrismaClient to call database
 *          Created user object for caller
 *          Some database helper functions
 */
export async function GetButtonInfo(callerInfo: User) {
    const prisma = new PrismaClient();
    const helper = new DatabaseHelper(prisma);
    const caller = await helper.getUser(callerInfo);
    return {
        prisma: prisma, 
        caller: caller,
        databaseHelper: helper 
    };
}