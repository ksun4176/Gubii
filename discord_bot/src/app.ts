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

// create a Discord client with the right intents
const client: Client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.MessageContent
    ],
    partials: [
        Partials.GuildMember,
        Partials.Message
    ]
});

// add all commands to be handled
client.commands = new Collection();
const commandCallbackFn = (command: CommandInterface) => {
    client.commands.set(command.data.name, command);
}
executeOnAllCommands(commandCallbackFn);

addEventListeners(client);

const main = async () => {
    try {
        await client.login(process.env.CLIENT_TOKEN);
        const app = express();
        const port = "80";
        app.use(express.json());
        app.get("/", (_req: Request, res: Response) => {
            res.send("Bot is up and running");
        });
        app.listen(port, () => console.log('Listening on port 80'));
    }
    catch (error) {
        console.log(error);
    }
}
main();