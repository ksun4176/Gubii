import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    user: 'user',
    game: 'game',
    guild: 'guild'
}

const buttons = {
    confirmKick: 'confirmKick',
    cancelKick: 'cancelKick'
}

const kickGuildCommand: CommandInterface = {
    data: new SlashCommandBuilder()
        .setName('kickguild')
        .setDescription('Kick a user out of guilds')
        .addUserOption(option =>
            option.setName(options.user)
                .setDescription('user to kick')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName(options.game)
                .setDescription('game guild is for')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName(options.guild)
                .setDescription('guild to kick out of')
                .setAutocomplete(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }

        const serverInfo = interaction.guild;
        const userInfo = interaction.options.getUser(options.user)!;
        const gameId = interaction.options.getInteger(options.game)!;
        const guildId = interaction.options.getInteger(options.guild);
            
        const confirmButton = new ButtonBuilder()
            .setCustomId(buttons.confirmKick)
            .setLabel('Confirm Kick')
            .setStyle(ButtonStyle.Danger);
        
        const cancelButton = new ButtonBuilder()
            .setCustomId(buttons.cancelKick)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton, cancelButton);
        
        const response = await interaction.reply({
            content: `Are you sure you want to remove guild roles?`,
            components: [actionRow]
        });

        try {
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 10000
            });

            if (confirmation.customId === buttons.cancelKick) {
                await confirmation.update({ content: 'Kick was canceled', components: [] });
            }
            else if (confirmation.customId === buttons.confirmKick) {
                await confirmation.deferUpdate();
                try {
                    const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);
        
                    const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });
                    const user = await prisma.user.findUniqueOrThrow({ where: {discordId: userInfo.id } });
        
                    const discordCaller = await interaction.guild.members.fetch(caller.discordId!);
                    const discordUser = await interaction.guild.members.fetch(user.discordId!);
        
                    let currentGuilds = await prisma.userRole.findMany({
                        where: {
                            roleType: UserRoleType.GuildMember,
                            serverId: server.id,
                            guild: {
                                guildId: { not: '' }, // not shared guild
                                gameId: gameId
                            }
                        },
                        include: { guild: true }
                    });
                    currentGuilds = currentGuilds.filter(role => 
                        discordUser.roles.cache.has(role.discordId!) && // check that the user is in these guilds
                        (!guildId || role.guildId === guildId)  // if guildId is provided, only match that one
                    );
                    
                    if (currentGuilds.length === 0) {
                        await interaction.editReply({ content: 'This user is not in any guilds to be removed from.', components: [] });
                        return;
                    }
        
                    let guildsNotKicked: typeof currentGuilds = [];
                    let guildsToKick: typeof currentGuilds = [];
                    // check if server owner OR admin
                    let roles: Prisma.UserRoleWhereInput[] = [
                        { serverId: server.id, roleType: UserRoleType.ServerOwner },
                        { serverId: server.id, roleType: UserRoleType.Administrator }
                    ];
                    let hasPermission = await databaseHelper.userHasPermission(discordCaller, serverInfo, roles);
                    if (hasPermission) {
                        guildsToKick = currentGuilds;
                    }
                    else {
                        // check if they have guild management
                        for (let role of currentGuilds) {
                            roles = [
                                { serverId: server.id, roleType: UserRoleType.GuildLead, guildId: role.guildId },
                                { serverId: server.id, roleType: UserRoleType.GuildManagement, guildId: role.guildId },
                            ];
                            hasPermission = await databaseHelper.userHasPermission(discordCaller, serverInfo, roles);
                            if (hasPermission) {
                                guildsToKick.push(role);
                            }
                            else {
                                guildsNotKicked.push(role);
                            }
                        }
                    }
                    if (guildsToKick.length === 0) {
                        await interaction.editReply({ content: 'You do not have permission to run this command', components: [] });
                        return;
                    }
                    discordUser.roles.remove(guildsToKick.map(role => role.discordId!));
        
                    let message = `'${user.name}' was removed from these guilds:\n`;
                    for (let role of guildsToKick) {
                        message += `- '${role.guild!.name}'\n`;
                    }
                    if (guildsNotKicked.length > 0) {
                        message += `You did not have permission to kick from these guilds:\n`;
                        for (let role of guildsNotKicked) {
                            message += `- '${role.guild!.name}'\n`;
                        }
                    }
                    console.log(message);
                    await interaction.editReply({ content: message, components: [] });
                    await databaseHelper.writeToLogChannel(interaction.guild, server.id, message);
                }
                catch (error) {
                    console.error(error);
                    await interaction.editReply({ content: 'There was an issue taking this action.', components: [] });
                }
            }
        }
        catch (error) {
            await interaction.editReply({ content: 'Confirmation not received, cancelling...', components: [] });
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.guild) {
            return;
        }
        const serverInfo = interaction.guild;
        const focusedOption = interaction.options.getFocused(true);
        
        try {
            const { prisma, databaseHelper } = await GetCommandInfo(interaction.user);
            const server = await prisma.server.findUniqueOrThrow({ where: {discordId: serverInfo.id } });
            
            switch (focusedOption.name) {
                case options.game:
                    const gameGuilds = await databaseHelper.getGameGuilds(server.id);
                    await interaction.respond(
                        gameGuilds.map(guild => ({ name: guild.game.name, value: guild.game.id }))
                    );
                    break;
                case options.guild:
                    const gameId = interaction.options.getInteger(options.game)!;
                    const guilds = await prisma.guild.findMany({
                        where: {
                            server: server,
                            gameId: gameId,
                            guildId: { not: '' },
                            active: true   
                        }
                    });
                    await interaction.respond(
                        guilds.map(guild => ({ name: guild.name, value: guild.id }))
                    );
                    break;
            }
        }
        catch (error) {
            console.log(error);
        }
    },
}

export = kickGuildCommand;

