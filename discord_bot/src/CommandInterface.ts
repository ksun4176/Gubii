import { PrismaClient } from "@prisma/client";
import { AutocompleteInteraction, ChatInputCommandInteraction, SharedSlashCommand, User } from "discord.js";
import { DatabaseHelper } from "./DatabaseHelper";

/**
 * Interface for individual commands.
 * This contains all the information used by command handlers in discord.
 */
export interface CommandInterface {
    data: SharedSlashCommand;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Get information needed for all commands
 * @param callerInfo information on caller of command
 * @returns PrismaClient to call database
 *          Created user object for caller
 *          Some database helper functions
 */
export async function GetCommandInfo(callerInfo: User) {
    const prisma = new PrismaClient();
    let caller = await prisma.user.findUnique({
        where: {
            discordId: callerInfo.id
        }
    });
    if (!caller) {
        caller = await prisma.user.create({
            data: {
                name: callerInfo.username,
                discordId: callerInfo.id
            }
        })
    }
    const helper = new DatabaseHelper(prisma);
    return {
        prisma: prisma, 
        caller: caller,
        databaseHelper: helper 
    };
}