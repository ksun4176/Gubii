import dotenv from "dotenv";
import { Client, Collection, IntentsBitField } from "discord.js";
import { CommandInterface } from "./CommandInterface";
import { addEventListeners, executeOnAllCommands } from "./DiscordHelper";

// augment client with the command property
declare module "discord.js" {
    interface Client {
        commands: Collection<string, CommandInterface>
  }
}
dotenv.config();

// create a Discord client with the right intents
const client: Client = new Client({ intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.DirectMessageReactions,
    IntentsBitField.Flags.MessageContent
] });

// add all commands to be handled
client.commands = new Collection();
const commandCallbackFn = (command: CommandInterface) => {
    client.commands.set(command.data.name, command);
}
executeOnAllCommands(commandCallbackFn);

addEventListeners(client);

client.login(process.env.CLIENT_TOKEN);