import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, CommandLevel, GetCommandInfo } from "../../CommandInterface";
import { ChannelPurposeType, UserRoleType } from "../../DatabaseHelper";

const options = {
    adminRole: 'adminrole',
    logChannel: 'logchannel'
}

const setupserverCommand: CommandInterface = {
    level: CommandLevel.All,
    data: new SlashCommandBuilder()
        .setName('setupserver')
        .setDescription('Adds server information to the database')
        .addRoleOption(option => 
            option.setName(options.adminRole)
                .setDescription('role for server admins')
        )
        .addChannelOption(option =>
            option.setName(options.logChannel)
                .setDescription('channel to log actions of the bot')
                .addChannelTypes(ChannelType.GuildText)
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;

        const adminRoleInfo = interaction.options.getRole(options.adminRole);
        const logChannelInfo = interaction.options.getChannel(options.logChannel);
        let errorMessage = 'There was an issue setting up the server.\n';
        try {
            const { prisma, caller, databaseHelper } = await GetCommandInfo(interaction.user);
            
            const discordCaller = await interaction.guild!.members.fetch(caller.discordId!);
            // check permission
            const hasPermission = await databaseHelper.userHasPermission(discordCaller, serverInfo, []);
            if (!hasPermission) {
                interaction.editReply('You do not have permission to run this command');
                return;
            }
            
            // create server object
            const server = await prisma.server.upsert({
                create: {
                    name: serverInfo.name,
                    discordId: serverInfo.id,
                },
                where: {
                    discordId: serverInfo.id
                },
                update: {
                    name: serverInfo.name
                }
            });
            let message = `### Server Is Now Set Up\n` +
                `- Name: ${server.name}\n`;

            // server owner role
            let ownerRole = await prisma.userRole.findFirst({
                where: {
                    server: server,
                    roleType: UserRoleType.ServerOwner
                }
            });
            if (!ownerRole) {
                ownerRole = await prisma.userRole.create({
                    data: {
                        name: `${server.name} Owner`,
                        serverId: server.id,
                        roleType: UserRoleType.ServerOwner
                    }
                });
            }
            message += `- Owner: <@${caller.discordId}>\n`;
            
            // admin role
            let adminRole = await prisma.userRole.findFirst({
                where: {
                    server: server,
                    roleType: UserRoleType.Administrator
                }
            });
            if (adminRoleInfo) {
                try {
                    if (adminRole) {
                        adminRole = await prisma.userRole.update({
                            where: { id: adminRole.id },
                            data: { 
                                name: adminRoleInfo.name,
                                discordId: adminRoleInfo.id
                            }
                        });
                    }
                    else {
                        adminRole = await prisma.userRole.create({
                            data: {
                                name: adminRoleInfo.name,
                                serverId: server.id,
                                roleType: UserRoleType.Administrator,
                                discordId: adminRoleInfo.id
                            }
                        });
                    }
                }
                catch (error) {
                    errorMessage += `- Could not add admin role. Has this role already been used?\n`;
                    throw error;
                }
            }

            // log channel
            let logChannel = await prisma.channelPurpose.findFirst({
                where: {
                    server: server,
                    channelType: ChannelPurposeType.BotLog
                }
            });
            if (logChannelInfo) {
                if (logChannel) {
                    logChannel = await prisma.channelPurpose.update({
                        where: { id: logChannel.id },
                        data: { 
                            discordId: logChannelInfo.id
                        }
                    });
                }
                else {
                    logChannel = await prisma.channelPurpose.create({
                        data: {
                            serverId: server.id,
                            channelType: ChannelPurposeType.BotLog,
                            discordId: logChannelInfo.id
                        }
                    });
                }
            }

            if (adminRole) {
                message += `- Admin role: <@&${adminRole.discordId}>\n`;
            }
            if (logChannel) {
                message += `- Log channel: <#${logChannel.discordId}>\n`;
            }
            console.log(message);
            message += `You can now call /addgame to add support for games you want on your server.\n`
            await interaction.editReply(message);
            await databaseHelper.writeToLogChannel(interaction.guild, server.id, message);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(errorMessage);
        }
    },
}

export = setupserverCommand;