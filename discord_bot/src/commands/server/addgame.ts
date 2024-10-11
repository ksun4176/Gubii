import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    game: 'game',
    leadrole: 'leadrole',
    managementrole: 'managementrole',
    memberrole: 'memberrole'
}

const addgameCommand: CommandInterface = {
    data: new SlashCommandBuilder()
        .setName('addgame')
        .setDescription('Add a game to the server')
        .addIntegerOption(option => 
            option.setName(options.game)
                .setDescription('game to add to server')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addRoleOption(option =>
            option.setName(options.leadrole)
            .setDescription('shared role for all guild leads for the game')
        )
        .addRoleOption(option =>
            option.setName(options.managementrole)
            .setDescription('shared role for all guild management for the game')
        )
        .addRoleOption(option =>
            option.setName(options.memberrole)
            .setDescription('shared role for all guild members for the game')
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;

        const gameId = interaction.options.getInteger(options.game)!;
        const leadRoleInfo = interaction.options.getRole(options.leadrole);
        const managementRoleInfo = interaction.options.getRole(options.managementrole);
        const memberRoleInfo = interaction.options.getRole(options.memberrole);
        let errorMessage = 'There was an issue adding support for the game.\n';
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);

            const server = await prisma.server.findUniqueOrThrow({ where: {discordId: serverInfo.id } });
            // check if server owner OR admin
            const roles: Prisma.UserRoleWhereInput[] = [
                { serverId: server.id, roleType: UserRoleType.ServerOwner },
                { serverId: server.id, roleType: UserRoleType.Administrator }
            ]
            const hasPermission = await databaseHelper.userHasPermission(caller.id, roles);
            if (!hasPermission) {
                interaction.editReply('Only the server owner and administrators have permission to run this command');
                return;
            }

            const gamePlaceholderGuild = await databaseHelper.createPlaceholderGuild(gameId, server.id);

            let message = `Game '${gamePlaceholderGuild.game.name}' is added to the server '${server.name}'\n`;
            if (leadRoleInfo) {
                try {
                    const leadRole = await databaseHelper.createGuildRole(gamePlaceholderGuild, UserRoleType.GuildLead, leadRoleInfo);
                    message += `- Lead role: <@&${leadRole.discordId}>\n`;
                }
                catch (error) {
                    errorMessage += `- Could not add lead role. Has this role already been used?\n`;
                    throw error;
                }
            }
            if (managementRoleInfo) {
                try {
                    const managementRole = await databaseHelper.createGuildRole(gamePlaceholderGuild, UserRoleType.GuildManagement, managementRoleInfo);
                    message += `- Management role: <@&${managementRole.discordId}>\n`;
                }
                catch (error) {
                    errorMessage += `- Could not add management role. Has this role already been used?\n`;
                    throw error;
                }
            }
            if (memberRoleInfo) {
                try {
                    const memberRole = await databaseHelper.createGuildRole(gamePlaceholderGuild, UserRoleType.GuildMember, memberRoleInfo);
                    message += `- Member role: <@&${memberRole.discordId}>\n`;
                }
                catch (error) {
                    errorMessage += `- Could not add member role. Has this role already been used?\n`;
                    throw error;
                }
            }
            
            console.log(message);
            message += `You can now call /createguild to add guilds for this game.\n`
            await interaction.editReply(message);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(errorMessage);
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        try {
            const { prisma } = await GetCommandInfo(interaction.user);
            const games = await prisma.game.findMany();
            await interaction.respond(
                games.map(game => ({ name: game.name, value: game.id })),
            );
        }
        catch (error) {
            console.log(error);
        }
    },
}

export = addgameCommand;