import { ActionRowBuilder, AutocompleteInteraction, ChatInputCommandInteraction, ModalActionRowComponentBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    user: 'user',
    game: 'game',
    guild: 'guild'
}

const modalFields = {
    confirmKickInput: 'confirmKickInput'
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

        const modal = new ModalBuilder()
			.setCustomId('confirmKickModal')
			.setTitle('Kick Confirmation?');
            
        const confirmInput = new TextInputBuilder()
            .setCustomId(modalFields.confirmKickInput)
            .setLabel('Are you sure you want to remove guild roles?')
            .setMaxLength(3)
            .setMinLength(1)
            .setPlaceholder('Respond with Yes or No')
            .setRequired(true)
            .setStyle(TextInputStyle.Short);

		const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(confirmInput);
        modal.addComponents(firstActionRow);
        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({ time: 10000 });
        const confirm = submitted.fields.getTextInputValue(modalFields.confirmKickInput).toLowerCase();
        if (confirm !== 'y' && confirm !== 'yes') {
            await submitted.reply({
                content: 'Action was canceled',
                ephemeral: true
            });
            return;
        }

        await submitted.deferReply();
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);

            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });
            const user = await prisma.user.findUniqueOrThrow({ where: {discordId: userInfo.id } });
            // get current roles
            const userRelations = await prisma.userRelation.findMany({ 
                where: { 
                    user: user,
                    role: { serverId: server.id }
                },
                include: { role: { include: { guild: true } } }
            });

            // find what guilds user is currently in so user can clean them all up if need be
            const guildRelations = userRelations.filter(relation => {
                return relation.role.roleType === UserRoleType.GuildMember &&
                    relation.role.guild?.gameId === gameId &&
                    (!guildId || relation.role.guildId === guildId);
            });
            if (guildRelations.length === 0) {
                await submitted.editReply('This user is not in any guilds to be removed from.');
                return;
            }

            // check if server owner OR admin
            let guildsToKick: typeof guildRelations = [];
            let roles: Prisma.UserRoleWhereInput[] = [
                { serverId: server.id, roleType: UserRoleType.ServerOwner },
                { serverId: server.id, roleType: UserRoleType.Administrator }
            ];
            let hasPermission = await databaseHelper.userHasPermission(caller.id, roles);
            if (hasPermission) {
                guildsToKick = guildRelations;
            }
            else {
                // check if they have guild management
                for (let index = guildRelations.length - 1; index >= 0; index--) {
                    const relation = guildRelations[index];
                    roles = [
                        { serverId: server.id, roleType: UserRoleType.GuildLead, guildId: relation.role.guildId },
                        { serverId: server.id, roleType: UserRoleType.GuildManagement, guildId: relation.role.guildId },
                    ];
                    hasPermission = await databaseHelper.userHasPermission(caller.id, roles);
                    if (hasPermission) {
                        guildsToKick.push(relation);
                    }
                }
            }
            if (guildsToKick.length === 0) {
                await submitted.editReply('You do not have permission to run this command');
                return;
            }

            await prisma.userRelation.deleteMany({ 
                where: { OR: guildsToKick.map(relation => { return { id: relation.id } }) }
            });
            if (user.discordId) {
                const discordUser = await submitted.guild!.members.fetch(user.discordId);
                discordUser.roles.remove(guildsToKick.filter(relation => !!relation.role.discordId).map(relation => relation.role.discordId!));
            }

            let message = `'${user.name}' was removed from these guilds:\n`;
            for (let relation of guildsToKick) {
                if (relation.role.guild?.guildId === '') {
                    continue;
                }
                message += `- '${relation.role.guild!.name}'\n`;
            }
            console.log(message);
            await submitted.editReply(message);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply('There was an issue taking this action.');
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
                    const gameGuilds = await databaseHelper.getPlaceholderGuilds(server.id);
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

