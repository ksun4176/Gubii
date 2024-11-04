import dotenv from "dotenv";
import { Client, Collection, IntentsBitField, Partials } from "discord.js";
import express, { Request, Response } from "express";
import { bindCommands, bindButtons, bindEvents } from "./utils/register";
import { BaseChatInputCommand } from "./utils/structures/BaseChatInputCommand";
import { BaseEvent } from "./utils/structures/BaseEvent";
import { BaseButton } from "./utils/structures/BaseButton";
// augment client with the command property
declare module "discord.js" {
	interface Client {
    chatInputCommands: Collection<string, BaseChatInputCommand>
    events: Collection<string, BaseEvent<any>>
    buttons: Collection<string, BaseButton>
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

	client.chatInputCommands = new Collection();
  client.events = new Collection();
  client.buttons = new Collection();

	await bindCommands(client)
  await bindEvents(client, "../events");
  await bindButtons(client, "../buttons");
  await client.login(process.env.CLIENT_TOKEN!);
  const app = express();
  app.use(express.json());
  app.get("/", (_req: Request, res: Response) => {
    res.send("Bot is up and running");
  });
  app.listen(port, () => console.log(`Listening on port ${port}`));
}

if (require.main === module) {
  main();
}