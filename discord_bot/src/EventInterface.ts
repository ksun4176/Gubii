import { PrismaClient } from "@prisma/client";
import { ClientEvents } from "discord.js";
import { DatabaseHelper } from "./DatabaseHelper";

/**
 * Interface for individual commands.
 * This contains all the information used by command handlers in discord.
 */
export interface EventInterface<Event extends keyof ClientEvents> {
    name: Event;
    once?: boolean;
    execute: (...args: ClientEvents[Event]) => void;
}

/**
 * Get information needed for all events
 * @returns PrismaClient to call database
 *          Some database helper functions
 */
export async function GetEventInfo() {
    const prisma = new PrismaClient();
    const helper = new DatabaseHelper(prisma);
    return {
        prisma: prisma, 
        databaseHelper: helper 
    };
}