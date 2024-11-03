import dotenv from "dotenv";
import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { CommandInterface, CommandLevel } from "./CommandInterface";
import { executeOnAllCommands } from "./DiscordHelper";
import { createConnection, MysqlError } from 'mysql';

dotenv.config();

export const DeployCommands = async () => {
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
	
	try {
		const rest = new REST().setToken(process.env.CLIENT_TOKEN!);

		console.log(`Started refreshing ${applicationCommands.length} application (/) commands.`);
		const appData = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID!),
			{ body: applicationCommands },
		);
		console.log(`Successfully reloaded ${(appData as any[]).length} application (/) commands.`);

		try {
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
					if (result.length === 0) {
						return;
					}
					console.log(`Started refreshing ${premiumCommands.length} premium (/) commands.`);
					for (const server of result) {
						try {
							if (!server.discord_id || server.discord_id === process.env.OWNER_SERVER_ID) {
								continue;
							}
							const premData = await rest.put(
								Routes.applicationGuildCommands(process.env.CLIENT_ID!, server.discord_id),
								{ body: premiumCommands }
							);
							console.log(`Successfully reloaded ${(premData as any[]).length} premium (/) commands in ${server.discord_id}.`);
						}
						catch (error) {
							console.error(error);
						}
					}
				});
				connection.end();
			})
		}
	} 
    catch (error) {
		console.error(error);
	}
};
DeployCommands();