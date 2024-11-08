import { Events, Interaction } from 'discord.js';
import { BaseEvent } from '../../utils/structures/BaseEvent';

export default class InteractionCreateEvent extends BaseEvent<Events.InteractionCreate> {
  constructor() {
    super(Events.InteractionCreate);
  }

  override async execute(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.chatInputCommands.get(interaction.commandName);
      try {
        if (!command) {
          throw new Error(`No command matching ${interaction.commandName} was found.`);
        }
        await command.execute(interaction);
      }
      catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } 
        else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
    }
    else if (interaction.isAutocomplete()) {
      const command = interaction.client.chatInputCommands.get(interaction.commandName);
      try {
        if (!command || !command.autocomplete) {
          throw new Error(`No command matching ${interaction.commandName} has autocomplete set up.`);
        }
        await command.autocomplete(interaction);
      } 
      catch (error) {
        console.error(error);
      }
    }
    else if (interaction.isButton()) {
      const button = interaction.client.buttons.get(interaction.customId);
      try {
        await button?.execute(interaction);
      }
      catch (error) {
        console.error(error);
      }
    }
  }
}