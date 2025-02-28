import { ActionRowBuilder, ButtonInteraction, ComponentType, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder } from "discord.js";
import { BaseButton } from "../utils/structures/BaseButton";
import { applyToGuild } from "../helpers/ApplyHelper";

const menus = {
  games: 'games'
}

export default class GuildApplyButton extends BaseButton {
  constructor() {
    super('guildApply');
  }

  override async execute(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      return;
    }
    const discordServer = interaction.guild;
    const originalMessage = interaction.message;
    await interaction.deferUpdate();

    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);
      const server = await databaseHelper.getServer(interaction.client, discordServer);
      if (!server) return;
      const gameGuilds = await databaseHelper.getGameGuilds(server.id);
      if (gameGuilds.length === 0) return;

      const options: StringSelectMenuOptionBuilder[] = [];
      for (const guild of gameGuilds) {
        options.push(new StringSelectMenuOptionBuilder()
          .setLabel(guild.name)
          .setValue(guild.id.toString())
        );
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId(menus.games)
        .setPlaceholder('Select what game to apply for')
        .addOptions(options);
      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(select);

      const response = await originalMessage.edit({
        components: [originalMessage.components[0], actionRow]
      });

      let gameGuildId = NaN;
      try {
        const selection = await response.awaitMessageComponent({
          filter: i => i.user.id === interaction.user.id && i.componentType === ComponentType.StringSelect,
          time: 10000
        });
        await selection.deferUpdate();
        if (!(selection instanceof StringSelectMenuInteraction)) {
          throw new Error('We did not process the string select of guild apply correctly');
        }

        if (selection.values.length !== 1) {
          throw new Error('We did not process the string select of guild apply correctly');
        }

        gameGuildId = parseInt(selection.values[0]);
      }
      catch (error) {
        console.error(error);
      }
      await originalMessage.edit({
        components: [originalMessage.components[0]]
      });
      if (!isNaN(gameGuildId)) {
        await applyToGuild(interaction, server, prisma, caller, databaseHelper, gameGuildId);
      }
    }
    catch (error) {
      console.error(error);
      await interaction.followUp({
        content: `Hi ${interaction.user}. There was an issue applying. Try again later.`,
        ephemeral: true   
      });
    }
  }
}