import dotenv from "dotenv";
import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from 'discord.js';
import { CommandInterface } from "./CommandInterface";
import { executeOnAllCommands } from "./DiscordHelper";

dotenv.config();

// Get all commands that need to be registered
const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const commandCallbackFn = (command: CommandInterface) => {
    commands.push(command.data.toJSON());
}
executeOnAllCommands(commandCallbackFn);

/**
 * Deploy the commands for the application
 */
const DeployCommands = async () => {
	try {
		const rest = new REST().setToken(process.env.CLIENT_TOKEN!);
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		const data = await rest.put(
			// Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.SERVER_ID!),
			Routes.applicationCommands(process.env.CLIENT_ID!),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${(data as any[]).length} application (/) commands.`);
	} 
    catch (error) {
		console.error(error);
	}
};
DeployCommands();