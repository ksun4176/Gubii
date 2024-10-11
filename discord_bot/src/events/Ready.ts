import { Client, Events } from "discord.js";
import { EventInterface } from "../EventInterface";

const readyEvent: EventInterface<Events.ClientReady> = {
    name: Events.ClientReady,
	once: true,
	execute(readyclient: Client<true>) {
		console.log(`Ready! Logged in as ${readyclient.user.tag}`);
	},
}

export = readyEvent;