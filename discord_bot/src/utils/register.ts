import dotenv from "dotenv";
import path from 'path';
import { promises as fs } from 'fs';
import { Client, REST, RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js';
import { BaseChatInputCommand, CommandLevel } from './structures/BaseChatInputCommand';
import { BaseEvent } from "./structures/BaseEvent";
import { BaseButton } from "./structures/BaseButton";
import { createConnection, MysqlError } from "mysql";

dotenv.config();

/**
 * Register events
 * @param client Client to register events to
 * @param dir relative path to events folder from where this function is defined
 */
export async function bindEvents(client: Client, dir: string) {
  const foldersPath = path.join(__dirname, dir);
  const folders = await fs.readdir(foldersPath);
  for (const file of folders) {
    const stat = await fs.lstat(path.join(foldersPath, file));
    const relFilePath = path.join(dir, file);
    if (stat.isDirectory()) {
      await bindEvents(client, relFilePath);
    }
    else if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: Event } = await import(path.join(dir, file));
      const event: BaseEvent<any> = new Event();
      const eventName = event.getEvent();
      client.events.set(eventName, event);
      if (event.getOnce()) {
        client.once(eventName, event.execute.bind(event));
      }
      else {
        client.on(eventName, event.execute.bind(event));
      }
    }
  }
}

/**
 * Register buttons
 * @param client Client to register buttons to
 * @param dir relative path to buttons folder from where this function is defined
 */
export async function bindButtons(client: Client, dir: string) {
  const foldersPath = path.join(__dirname, dir);
  const folders = await fs.readdir(foldersPath);
  for (const file of folders) {
    const stat = await fs.lstat(path.join(foldersPath, file));
    const relFilePath = path.join(dir, file);
    if (stat.isDirectory()) {
      await bindButtons(client, relFilePath);
    }
    else if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: Button } = await import(path.join(dir, file));
      const button: BaseButton = new Button();
      client.buttons.set(button.getCustomId(), button);
    }
  }
}

/**
 * Find all commands and execute a callback on them
 * @param dir relative path to commands folder from where this function is defined
 * @param callbackFn The callback
 */
async function executeOnAllCommands(dir: string, callbackFn: (command: BaseChatInputCommand) => void) {
  const foldersPath = path.join(__dirname, dir);
  const folders = await fs.readdir(foldersPath);
  for (const file of folders) {
    const stat = await fs.lstat(path.join(foldersPath, file));
    const relFilePath = path.join(dir, file);
    if (stat.isDirectory()) {
      await executeOnAllCommands(relFilePath, callbackFn);
    }
    else if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: Command } = await import(relFilePath);
      const command: BaseChatInputCommand = new Command();
      callbackFn(command);
    }
  }
}

/**
 * Bind commands to the client so it can be triggered
 * @param client Client to register commands to
 */
export async function bindCommands(client: Client) {
  const callbackFn = (command: BaseChatInputCommand) => {
    client.chatInputCommands.set(command.getName(), command);
  }
  await executeOnAllCommands("../commands", callbackFn);
}

/**
 * Get a map of commands to register separated by their level
 * @returns A map of command levels to all their commands
 */
async function getCommandsToRegister() {
  const commandsMap: Map<CommandLevel, RESTPostAPIApplicationCommandsJSONBody[]> = new Map();
  const callbackFn = (command: BaseChatInputCommand) => {
    const commandLevel = command.getLevel();
    if (!commandsMap.has(commandLevel)) {
      commandsMap.set(commandLevel, []);
    }
    commandsMap.get(commandLevel)!.push(command.getDefinition().toJSON());
  }
  await executeOnAllCommands("../commands", callbackFn);
  return commandsMap;
}

/**
 * Register global commands
 * @param applicationCommands application commands
 * @param rest Discord API endpoint manager
 */
async function registerGlobalCommands(globalCommands?: RESTPostAPIApplicationCommandsJSONBody[], rest?: REST) {
  try {
		if (!rest) {
			rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		}
		if (globalCommands === undefined) {
			const commandsMap = await getCommandsToRegister();
      globalCommands = commandsMap.get(CommandLevel.All) ?? [];
		}
		console.log(`Started refreshing ${globalCommands.length} global (/) commands.`);
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: globalCommands },
    );
		console.log(`Successfully reloaded ${(data as any[]).length} global (/) commands.`);
	}
    catch (error) {
		console.error(error);
	}
}

/**
 * Register owner commands
 * @param ownerCommands owner commands
 * @param rest Discord API endpoint manager
 */
async function registerOwnerCommands(ownerCommands?: RESTPostAPIApplicationCommandsJSONBody[], rest?: REST) {
  try {
		if (!rest) {
			rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		}
		if (ownerCommands === undefined) {
			const commandsMap = await getCommandsToRegister();
      ownerCommands = commandsMap.get(CommandLevel.Owner) ?? [];
		}
		console.log(`Started refreshing ${ownerCommands.length} owner (/) commands.`);
    const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.OWNER_SERVER_ID!),
      { body: ownerCommands },
    );
		console.log(`Successfully reloaded ${(data as any[]).length} owner (/) commands.`);
	}
    catch (error) {
		console.error(error);
	}
}
/**
 * Register premium commands
 * @param serverId Discord Server ID
 * @param premiumCommands premium commands
 * @param rest Discord API endpoint manager
 */
export async function registerPremiumCommands(serverId: string, premiumCommands?: RESTPostAPIApplicationCommandsJSONBody[], rest?: REST) {
  try {
    if (serverId === process.env.OWNER_SERVER_ID!) {
      return;
    }
		if (!rest) {
			rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		}
		if (premiumCommands === undefined) {
			const commandsMap = await getCommandsToRegister();
      premiumCommands = commandsMap.get(CommandLevel.Premium) ?? [];
		}
		console.log(`Started refreshing ${premiumCommands.length} premium (/) commands.`);
    const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID!, serverId),
      { body: premiumCommands },
    );
		console.log(`Successfully reloaded ${(data as any[]).length} premium (/) commands.`);
	}
    catch (error) {
		console.error(error);
	}
}

export async function registerAllCommands() {
  const commandsMap = await getCommandsToRegister();
  try {
    const rest = new REST().setToken(process.env.CLIENT_TOKEN!);
    await registerGlobalCommands(commandsMap.get(CommandLevel.All), rest);
    await registerOwnerCommands(commandsMap.get(CommandLevel.Owner), rest);
    
    const premiumCommands = commandsMap.get(CommandLevel.Premium);
    if (premiumCommands && premiumCommands.length > 0) {
      const connection = createConnection({
				host: process.env.DB_HOST,
				user: process.env.DB_USER,
				password: process.env.DB_PASSWORD,
				database: process.env.DB_NAME
			});

			connection.connect((error: MysqlError) => {
				if (error) throw error;
				const sqlQuery = "SELECT id, discord_id FROM SERVER WHERE active AND is_premium";
				connection.query(sqlQuery, async (err, result) => {
					if (err) throw err;
					if (result.length === 0) return;
					for (const server of result) {
						if (!server.discord_id) {
							continue;
						}
						await registerPremiumCommands(server.discord_id, premiumCommands, rest);
					}
				});
				connection.end();
			});
    }
  }
  catch (error) {
    console.error(error);
  }
}

if (require.main === module) {
  registerAllCommands();
}