import { AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, CommandLevel, GetCommandInfo } from "../../CommandInterface";
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    event: 'event',
    channel: 'channel'
}

const addServerTriggersCommand: CommandInterface = {
    level: CommandLevel.Premium,
    data: new SlashCommandBuilder()
        .setName('addservertriggers')
        .setDescription('Add text to be sent based on actions triggered for the server')
        .addIntegerOption(option => 
            option.setName(options.event)
                .setDescription('event the trigger is for')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addChannelOption(option =>
            option.setName(options.channel)
                .setDescription('channel text should go to')
                .setRequired(true)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;
        const eventId = interaction.options.getInteger(options.event)!;
        let channelInfo = interaction.options.getChannel(options.channel)!;
        let errorMessage = 'There was an issue adding the trigger.\n';
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
            let serverMessage = await prisma.serverMessage.findUnique({ where: {
                serverId_eventId: {
                    serverId: server.id,
                    eventId: eventId
                }
            }});
            if (serverMessage) {
                message += `Here is the old text:\n\`\`\`${serverMessage.text}\`\`\`\n`;
            }
            message += `You can now enter your new text in the chat:\n`;
            await interaction.editReply(message);

            try {
                const response = await interaction.channel.awaitMessages({
                    filter: message => message.author.id === caller.discordId,
                    max: 1,
                    time: 600_000,
                });

                let serverMessageText = response.first()!.content;

                if (serverMessageText) {
                    await prisma.serverMessage.upsert({
                        create: {
                            serverId: server.id,
                            eventId: eventId,
                            text: serverMessageText,
                            channelId: channelInfo.id
                        },
                        where: {
                            serverId_eventId: {
                                serverId: server.id,
                                eventId: eventId
                            }
                        },
                        update: {
                            text: serverMessageText,
                            channelId: channelInfo.id
                        },
                    })
                    message = `**The new text:**\n${serverMessageText}\n\n**Text will be sent to <#${channelInfo.id}> on event trigger.**\n`;
                    console.log(message);
                    await databaseHelper.writeToLogChannel(serverInfo, server.id, message);
                }
                else {
                    message = 'Nothing was entered so text was not overwritten.';
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
            let serverEvents = await prisma.serverEvent.findMany();
            await interaction.respond(
                serverEvents.map(event => ({ name: event.name, value: event.id }))
            );
        }
        catch (error) {
            console.log(error);
        }
    }
}

export = addServerTriggersCommand;