import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, CommandLevel, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    name: 'name',
}

const addgameToDbCommand: CommandInterface = {
    level: CommandLevel.Owner,
    data: new SlashCommandBuilder()
        .setName('addgametodb')
        .setDescription('Add a game to the database')
        .addStringOption(option => 
            option.setName(options.name)
                .setDescription('name of the game to add')
                .setRequired(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;

        const name = interaction.options.getString(options.name)!;
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);

            const server = await prisma.server.findUniqueOrThrow({ where: {discordId: serverInfo.id } });
            const discordCaller = await interaction.guild!.members.fetch(caller.discordId!);
            // check if server owner OR admin
            const roles: Prisma.UserRoleWhereInput[] = [
                { serverId: server.id, roleType: UserRoleType.ServerOwner },
                { serverId: server.id, roleType: UserRoleType.Administrator }
            ]
            const hasPermission = await databaseHelper.userHasPermission(discordCaller, serverInfo, roles);
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

export = addgameToDbCommand;