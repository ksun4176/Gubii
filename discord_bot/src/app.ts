import dotenv from "dotenv";
import { Client, Collection, IntentsBitField, Partials } from "discord.js";
import { CommandInterface } from "./CommandInterface";
import { addEventListeners, executeOnAllCommands } from "./DiscordHelper";
import express, { Request, Response } from "express";

// augment client with the command property
declare module "discord.js" {
    interface Client {
        commands: Collection<string, CommandInterface>
  }
}
dotenv.config();

const main = async () => {
    const port = process.env.BOT_PORT ?? "9000";
	const client: Client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMembers,
			IntentsBitField.Flags.GuildMessages,
			IntentsBitField.Flags.GuildMessageReactions,
			IntentsBitField.Flags.DirectMessages,
			IntentsBitField.Flags.MessageContent
		],
		partials: [
			Partials.GuildMember,
			Partials.Message
		]
	});

	client.commands = new Collection();
	const setCommandExecutables = (command: CommandInterface) => {
		client.commands.set(command.data.name, command);
	}
	executeOnAllCommands(setCommandExecutables);

	addEventListeners(client);
	
    try {
        await client.login(process.env.CLIENT_TOKEN);
        const app = express();
        app.use(express.json());
        app.get("/", (_req: Request, res: Response) => {
            res.send("Bot is up and running");
        });
        app.listen(port, () => console.log(`Listening on port ${port}`));
    }
    catch (error) {
        console.log(error);
    }
}
main();