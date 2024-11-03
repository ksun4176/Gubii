import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, CommandLevel, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";
import { DeployPremiumCommands } from "../../deployCommands";

const options = {
    server: 'server',
    enable: 'enable'
}

const addPremiumServerCommand: CommandInterface = {
    level: CommandLevel.Owner,
    data: new SlashCommandBuilder()
        .setName('addpremiumserver')
        .setDescription('Add a game to the database')
        .addIntegerOption(option => 
            option.setName(options.server)
                .setDescription('Server to add')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addBooleanOption(option =>
            option.setName(options.enable)
                .setDescription('Whether to enable/disable premium')
                .setRequired(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;

        const serverId = interaction.options.getInteger(options.server)!;
        const enable = interaction.options.getBoolean(options.enable)!;

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

            const serverUpdated = await prisma.server.update({
                where: {
                    id: serverId
                },
                data: {
                    isPremium: enable
                }
            });

            await DeployPremiumCommands(serverUpdated.discordId!, serverUpdated.isPremium ? undefined : []);

            let message = `Server '${serverUpdated.name}' is  ${serverUpdated.isPremium ? 'enabled' : 'disabled'} \n`;
            console.log(message);
            await interaction.editReply(message);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply('There was an issue updating the server.');
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        try {
            const { prisma } = await GetCommandInfo(interaction.user);
            const servers = await prisma.server.findMany({
                where: {
                    discordId: { not: null },
                    active: true
                }
            });
            await interaction.respond(
                servers.map(server => ({ name: server.name, value: server.id })),
            );
        }
        catch (error) {
            console.log(error);
        }
    },
}

export = addPremiumServerCommand;