import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../helpers/DatabaseHelper";

const options = {
  name: 'name',
}

export default class AddGameToDBCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('addgametodb')
      .setDescription('Add a game to the database')
      .addStringOption(option => 
        option.setName(options.name)
          .setDescription('name of the game to add')
          .setRequired(true)
      );
    super(CommandLevel.Owner, data);
  }
    
  override async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply('This command needs to be ran in a server');
      return;
    }
    await interaction.deferReply();
    const discordServer = interaction.guild;

    const name = interaction.options.getString(options.name)!;
    try {
      const { prisma, caller, databaseHelper } = await this.GetHelpers(interaction.user);

      const server = await databaseHelper.getServer(discordServer);
      const discordCaller = await discordServer.members.fetch(caller.discordId!);
      // check if server owner OR admin
      const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
        { serverId: server.id, roleType: UserRoleType.Administrator }
      ]
      const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
      if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return;
      }

      const game = await prisma.game.create({
        data: {
          name: name
        }
      });

      let message = `Game '${game.name}' is added to the database\n`;
      console.log(message);
      await interaction.editReply(message);
    }
    catch (error) {
      console.error(error);
      await interaction.editReply('There was an issue adding support for the game.');
    }
  }
}