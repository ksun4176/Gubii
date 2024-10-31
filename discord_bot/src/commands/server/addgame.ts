import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, CommandLevel, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { ChannelPurposeType, UserRoleType } from "../../DatabaseHelper";

const options = {
    game: 'game',
    leadrole: 'leadrole',
    managementrole: 'managementrole',
    memberrole: 'memberrole',
    recruitThread: 'recruitthread',
    applicantThread: 'applicantthread'
}

const addgameCommand: CommandInterface = {
    level: CommandLevel.All,
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
            .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName(options.managementrole)
            .setDescription('shared role for all guild management for the game')
            .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName(options.memberrole)
            .setDescription('shared role for all guild members for the game')
            .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName(options.recruitThread)
            .setDescription('thread channel to send applications for review')
            .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName(options.applicantThread)
            .setDescription('thread channel for applicants to fill out applications in')
            .setRequired(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;

        const gameId = interaction.options.getInteger(options.game)!;
        const leadRoleInfo = interaction.options.getRole(options.leadrole)!;
        const managementRoleInfo = interaction.options.getRole(options.managementrole)!;
        const memberRoleInfo = interaction.options.getRole(options.memberrole)!;
        const recruitChannelInfo = interaction.options.getChannel(options.recruitThread)!;
        const applicantChannelInfo = interaction.options.getChannel(options.applicantThread)!;
        let errorMessage = 'There was an issue adding support for the game.\n';
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

            const gameGuild = await databaseHelper.createGameGuild(gameId, server.id);

            let message = `Game '${gameGuild.game.name}' is added to the server '${server.name}'\n`;
            try {
                const leadRole = await databaseHelper.createGuildRole(gameGuild, UserRoleType.GuildLead, leadRoleInfo);
                message += `- Lead role: <@&${leadRole.discordId}>\n`;
            }
            catch (error) {
                errorMessage += `- Could not add lead role. Has this role already been used?\n`;
                throw error;
            }
            try {
                const managementRole = await databaseHelper.createGuildRole(gameGuild, UserRoleType.GuildManagement, managementRoleInfo);
                message += `- Management role: <@&${managementRole.discordId}>\n`;
            }
            catch (error) {
                errorMessage += `- Could not add management role. Has this role already been used?\n`;
                throw error;
            }
            try {
                const memberRole = await databaseHelper.createGuildRole(gameGuild, UserRoleType.GuildMember, memberRoleInfo);
                message += `- Member role: <@&${memberRole.discordId}>\n`;
            }
            catch (error) {
                errorMessage += `- Could not add member role. Has this role already been used?\n`;
                throw error;
            }

            if (recruitChannelInfo.type !== ChannelType.GuildText) {
                errorMessage += `- Could not add recruitment channel. It needs to be a text channel.\n`;
                throw new Error(errorMessage);
            }
            else {
                const recruitThread = await databaseHelper.creatGameChannel(gameGuild, ChannelPurposeType.Recruitment, recruitChannelInfo.id);
                message += `- Recruitment thread: <#${recruitThread!.discordId}>\n`;
            }

            if (applicantChannelInfo.type !== ChannelType.GuildText) {
                errorMessage += `- Could not add applicant channel. It needs to be a text channel.\n`;
                throw new Error(errorMessage);
            }
            else {
                const applicantChannel = await databaseHelper.creatGameChannel(gameGuild, ChannelPurposeType.Applicant, applicantChannelInfo.id);
                message += `- Applicant thread: <#${applicantChannel!.discordId}>\n`;
            }
            
            console.log(message);
            message += `You can now call /createguild to add guilds for this game.\n **(Recommended)** You can also call /addgametriggers to set up the application for the game`
            await interaction.editReply(message);
            await databaseHelper.writeToLogChannel(interaction.guild, server.id, message);
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