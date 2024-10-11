import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    game: 'game',
    ingameid: 'ingameid',
    name: 'name',
    leadrole: 'leadrole',
    managementrole: 'managementrole',
    memberrole: 'memberrole'
}

const createguildCommand: CommandInterface = {
    data: new SlashCommandBuilder()
        .setName('createguild')
        .setDescription('Create (or update) a guild in the server')
        .addIntegerOption(option =>
            option.setName(options.game)
                .setDescription('game guild is in')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName(options.ingameid)
                .setDescription('ID in game')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName(options.name)
            .setDescription('name of guild')
            .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName(options.leadrole)
            .setDescription('role for guild lead')
            .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName(options.managementrole)
            .setDescription('role for guild management')
            .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName(options.memberrole)
            .setDescription('role for guild members')
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
        const inGameId = interaction.options.getString(options.ingameid)!;
        const name = interaction.options.getString(options.name)!;
        const leadRoleInfo = interaction.options.getRole(options.leadrole)!;
        const managementRoleInfo = interaction.options.getRole(options.managementrole)!;
        const memberRoleInfo = interaction.options.getRole(options.memberrole)!;
        let errorMessage = 'There was an issue creating the guild.\n';
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

            // create guild object
            const guild = await prisma.guild.upsert({
                create: {
                    name: name,
                    serverId: server.id,
                    gameId: gameId,
                    guildId: inGameId
                },
                where: {
                    gameId_guildId_serverId: {
                        serverId: server.id,
                        gameId: gameId,
                        guildId: inGameId
                    }
                },
                update: {
                    active: true,
                    name: name
                },
                include: {
                    game: true
                }
            });
            let message = `### Guild Added\n` +
                `- ID: ${guild.id}\n` +
                `- Name: ${guild.name}\n` +
                `- Game: ${guild.game.name}\n`;
            
            try {
                const leadRole = await databaseHelper.createGuildRole(guild, UserRoleType.GuildLead, leadRoleInfo);
                message += `- Lead role: <@&${leadRole.discordId}>\n`;
            }
            catch (error) {
                errorMessage += `- Could not add lead role. Has this role already been used?\n`;
                throw error;
            }
            try {
                const managementRole = await databaseHelper.createGuildRole(guild, UserRoleType.GuildManagement, managementRoleInfo);
                message += `- Management role: <@&${managementRole.discordId}>\n`;
            }
            catch (error) {
                errorMessage += `- Could not add management role. Has this role already been used?\n`;
                throw error;
            }
            try {
                const memberRole = await databaseHelper.createGuildRole(guild, UserRoleType.GuildMember, memberRoleInfo);
                message += `- Member role: <@&${memberRole.discordId}>\n`;
            }
            catch (error) {
                errorMessage += `- Could not add member role. Has this role already been used?\n`;
                throw error;
            }

            console.log(message);
            await interaction.editReply(message);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(errorMessage);
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.guild) {
            return;
        }
        const serverInfo = interaction.guild;
        
        try {
            const { prisma, databaseHelper } = await GetCommandInfo(interaction.user);
            const server = await prisma.server.findUniqueOrThrow({ where: {discordId: serverInfo.id } });
            const gameGuilds = await databaseHelper.getPlaceholderGuilds(server.id);
            await interaction.respond(
                gameGuilds.map(guild => ({ name: guild.game.name, value: guild.game.id })),
            );
        }
        catch (error) {
            console.log(error);
        }
    },
}

export = createguildCommand;