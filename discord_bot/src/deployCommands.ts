import dotenv from "dotenv";
import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { CommandInterface, CommandLevel } from "./CommandInterface";
import { executeOnAllCommands } from "./DiscordHelper";
import { createConnection, MysqlError } from 'mysql';

dotenv.config();

/**
 * Separate all commands handled by bot into 3 buckets to be added to global or guild levels
 * @returns Commands separated into application, premium, and owner buckets
 */
const getCommandsToRegister = () => {
	const applicationCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
	const premiumCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
	const ownerCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
	const addCommandsToRegister = (command: CommandInterface) => {
		switch (command.level) {
			case CommandLevel.Owner:
				ownerCommands.push(command.data.toJSON());
				break;
			case CommandLevel.Premium:
				premiumCommands.push(command.data.toJSON());
				ownerCommands.push(command.data.toJSON());
				break;
			default:
				applicationCommands.push(command.data.toJSON());
				break;
		}
	}
	executeOnAllCommands(addCommandsToRegister);
	return {
		applicationCommands: applicationCommands,
		premiumCommands: premiumCommands,
		ownerCommands: ownerCommands
	};
}

/**
 * Deploy global commands
 * @param applicationCommands application commands
 * @param rest Discord API endpoint manager
 */
const DeployApplicationCommands = async (applicationCommands?: RESTPostAPIChatInputApplicationCommandsJSONBody[], rest?: REST) => {
	try {
		if (!rest) {
			rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		}
		if (applicationCommands === undefined) {
			applicationCommands = getCommandsToRegister().applicationCommands;
		}
		console.log(`Started refreshing ${applicationCommands.length} application (/) commands.`);
			const appData = await rest.put(
				Routes.applicationCommands(process.env.CLIENT_ID!),
				{ body: applicationCommands },
			);
		console.log(`Successfully reloaded ${(appData as any[]).length} application (/) commands.`);
	}
    catch (error) {
		console.error(error);
	}
}

/**
 * Deploy owner commands
 * @param ownerCommands owner commands
 * @param rest Discord API endpoint manager
 */
const DeployOwnerCommands = async (ownerCommands?: RESTPostAPIChatInputApplicationCommandsJSONBody[], rest?: REST) => {
	try {
		if (!rest) {
			rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		}
		if (ownerCommands === undefined) {
			ownerCommands = getCommandsToRegister().ownerCommands;
		}
		console.log(`Started refreshing ${ownerCommands.length} owner (/) commands.`);
		const ownerData = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.OWNER_SERVER_ID!),
			{ body: ownerCommands }
		);
		console.log(`Successfully reloaded ${(ownerData as any[]).length} owner (/) commands.`);
	}
    catch (error) {
		console.error(error);
	}
}

/**
 * Deploy premium commands
 * @param serverId Discord Server ID
 * @param premiumCommands premium commands
 * @param rest Discord API endpoint manager
 */
export const DeployPremiumCommands = async (serverId: string, premiumCommands?: RESTPostAPIChatInputApplicationCommandsJSONBody[], rest?: REST) => {
	try {
		if (serverId === process.env.OWNER_SERVER_ID) {
			return;
		}
		if (!rest) {
			rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		}
		if (premiumCommands === undefined) {
			premiumCommands = getCommandsToRegister().premiumCommands;
		}
		if (premiumCommands.length === 0) {
			return;
		}
		console.log(`Started refreshing ${premiumCommands.length} premium (/) commands in ${serverId}.`);
		const premData = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID!, serverId),
			{ body: premiumCommands }
		);
		console.log(`Successfully reloaded ${(premData as any[]).length} premium (/) commands in ${serverId}.`);
	}
    catch (error) {
		console.error(error);
	}
}

/**
 * Deploy all commands
 */
export const DeployAllCommands = async () => {
	const {applicationCommands, premiumCommands, ownerCommands } = getCommandsToRegister();
	try {
		const rest = new REST().setToken(process.env.CLIENT_TOKEN!);

		await DeployApplicationCommands(applicationCommands, rest);

		await DeployOwnerCommands(ownerCommands, rest);

		if (premiumCommands.length > 0) {
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
						await DeployPremiumCommands(server.discord_id, premiumCommands, rest);
					}
				});
				connection.end();
			});
		}
	} 
    catch (error) {
		console.error(error);
	}
};

if (require.main === module) {
	DeployAllCommands();
}