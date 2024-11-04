import { Client, Events } from 'discord.js';
import { BaseEvent } from '../../utils/structures/BaseEvent';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
  constructor() {
    super(Events.ClientReady, true);
  }

  override async execute(readyClient: Client<true>): Promise<void> {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  }
}