import fs from "fs";
import path from "path";
import { Client, ClientEvents } from "discord.js";
import { CommandInterface } from "./CommandInterface";
import { EventInterface } from "./EventInterface";

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