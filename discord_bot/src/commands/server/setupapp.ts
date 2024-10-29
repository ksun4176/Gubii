import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, CommandLevel, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    game: 'game'
}

const setupappCommand: CommandInterface = {
    level: CommandLevel.All,
    data: new SlashCommandBuilder()
        .setName('setupapp')
        .setDescription('Add information for the guild application')
        .addIntegerOption(option => 
            option.setName(options.game)
                .setDescription('game to provide an application for')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;
        const gameId = interaction.options.getInteger(options.game)!;
        let errorMessage = 'There was an issue adding the application.\n';
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

            let message = '';
            let application = await prisma.guildApplication.findUnique({ where: {
                serverId_gameId: {
                    serverId: server.id,
                    gameId: gameId
                }
            }});
            if (application) {
                message += `Here is the old application:\n\`\`\`${application.text}\`\`\`\n`;
            }
            message += `Enter your new application here:\n`;
            await interaction.editReply(message);

            try {
                const response = await interaction.channel.awaitMessages({
                    filter: message => message.author.id === caller.discordId,
                    max: 1,
                    time: 600_000,
                });

                const applicationText = response.first()!.content.replace(/```/g,'');
                if (applicationText) {
                    await prisma.guildApplication.upsert({
                        create: {
                            text: applicationText,
                            serverId: server.id,
                            gameId: gameId
                        },
                        where: {
                            serverId_gameId: {
                                serverId: server.id,
                                gameId: gameId
                            }
                        },
                        update: {
                            text: applicationText
                        },
                    })
                    message = `The new application:\n\`\`\`${applicationText}\`\`\`\n`;
                    console.log(message);
                    await databaseHelper.writeToLogChannel(serverInfo, server.id, message);
                }
                else {
                    message = 'Nothing was entered so application was not overwritten.';
                }
                await interaction.followUp(message);
            }
            catch (error) {
                console.error(error);
                await interaction.followUp(errorMessage);
            }
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

export = setupappCommand;