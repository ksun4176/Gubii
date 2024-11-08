import { Events, Guild } from "discord.js";
import { BaseEvent } from '../../utils/structures/BaseEvent';

export default class GuildCreateEvent extends BaseEvent<Events.GuildCreate> {
  constructor() {
    super(Events.GuildCreate);
  }

  override async execute(discordServer: Guild): Promise<void> {
    try {
      const { databaseHelper } = await this.GetHelpers();
      const server = await databaseHelper.createServer(discordServer.client, discordServer);
      if (!server) return;
      console.log(`Server ${server.name}[${server.discordId}] was added`);
    }
    catch (error) {
        console.log(error);
    }
  }
}