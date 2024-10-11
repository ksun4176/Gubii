import { Events, Interaction } from "discord.js";
import { CommandInterface } from "../CommandInterface";
import { EventInterface } from "../EventInterface";

const interactionCreateEvent: EventInterface<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
	async execute(interaction: Interaction) {
        if (interaction.isChatInputCommand()) {
            const command: CommandInterface | undefined = interaction.client.commands.get(interaction.commandName);
        
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
        
            try {
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
            const command: CommandInterface | undefined = interaction.client.commands.get(interaction.commandName);
        
            if (!command || !command.autocomplete) {
                console.error(`No command matching ${interaction.commandName} has autocomplete set up.`);
                return;
            }

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(error);
            }
        }
    },
}

export = interactionCreateEvent;