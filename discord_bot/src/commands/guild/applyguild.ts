import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";

const options = {
    game: 'game',
    guild: 'guild'
}

const applyguildCommand: CommandInterface = {
    data: new SlashCommandBuilder()
        .setName('applyguild')
        .setDescription('Apply to a guild')
        .addIntegerOption(option =>
            option.setName(options.game)
                .setDescription('game to apply for')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName(options.guild)
                .setDescription('guild to specifically apply to')
                .setAutocomplete(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;
        
        const gameId = interaction.options.getInteger(options.game)!;
        let guildId = interaction.options.getInteger(options.guild);
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);

            const server = await prisma.server.findUniqueOrThrow({ where: { discordId: serverInfo.id } });

            if (!guildId) {
                const placeholderGuilds = await databaseHelper.getPlaceholderGuilds(server.id);
                const gameGuild = placeholderGuilds.find(guild => guild.gameId = gameId);
                if (gameGuild) {
                    guildId = gameGuild.id
                }
            }

            if (!guildId) {
                throw new Error('Game not supported in server');
            }
            await prisma.guildApplicant.create({
                data: {
                    userId: caller.id,
                    guildId: guildId,
                    gameId: gameId,
                    serverId: server.id
                }
            });
            console.log(`${caller.name} applied to ${guildId}`);
            await interaction.editReply(`You have successfully applied`);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply('There was an issue applying. Try again or contact an admin.');
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

export = applyguildCommand;