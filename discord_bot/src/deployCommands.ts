import dotenv from "dotenv";
import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { CommandInterface, CommandLevel } from "./CommandInterface";
import { executeOnAllCommands } from "./DiscordHelper";

dotenv.config();

// Get all commands that need to be registered
const applicationCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const premiumCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const ownerCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const commandCallbackFn = (command: CommandInterface) => {
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
executeOnAllCommands(commandCallbackFn);

/**
 * Deploy the commands for the application
 */
const DeployCommands = async () => {
	try {
		const rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		console.log(`Started refreshing ${applicationCommands.length} application (/) commands.`);
		const appData = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID!),
			{ body: applicationCommands },
		);
		console.log(`Successfully reloaded ${(appData as any[]).length} application (/) commands.`);

		// need to get list of premium server IDs
		// console.log(`Started refreshing ${premiumCommands.length} premium (/) commands.`);
		// const premData = await rest.put(
		// 	Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.SERVER_ID!),
		// 	{ body: premiumCommands }
		// );
		// console.log(`Successfully reloaded ${(premData as any[]).length} premium (/) commands.`);

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
};
DeployCommands();