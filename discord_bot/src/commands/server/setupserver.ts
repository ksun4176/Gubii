import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CommandInterface, GetCommandInfo } from "../../CommandInterface";
import { UserRoleType } from "../../DatabaseHelper";

const options = {
    adminRole: 'adminrole'
}

const setupserverCommand: CommandInterface = {
    data: new SlashCommandBuilder()
        .setName('setupserver')
        .setDescription('Adds server information to the database')
        .addRoleOption(option => 
            option.setName(options.adminRole)
                .setDescription('role for server admins')
        ),
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply('This command needs to be ran in a server');
            return;
        }
        await interaction.deferReply();
        const serverInfo = interaction.guild;
        const ownerInfo = await serverInfo.fetchOwner();

        const adminRoleInfo = interaction.options.getRole(options.adminRole);
        let errorMessage = 'There was an issue setting up the server.\n';
        try {
            const { prisma, caller } = await GetCommandInfo(interaction.user);
            
            // check permission
            if (ownerInfo.id !== caller.discordId) {
                interaction.editReply('Only the server owner has permission to run this command');
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

            // assign server owner
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
            const ownerRelation = await prisma.userRelation.findFirst({ 
                where: { role: ownerRole } 
            });
            if (!ownerRelation) {
                await prisma.userRelation.create({ 
                    data: {
                        userId: caller.id,
                        roleId: ownerRole.id
                    }
                });
            }
            else {
                await prisma.userRelation.update({
                    where: ownerRelation,
                    data: { userId: caller.id }
                });
            }
            message += `- Owner: <@${caller.discordId}>\n`;
            
            if (adminRoleInfo) {
                try {
                    await prisma.userRole.create({
                        data: {
                            name: adminRoleInfo.name,
                            serverId: server.id,
                            roleType: UserRoleType.Administrator,
                            discordId: adminRoleInfo.id
                        }
                    });
                }
                catch (error) {
                    errorMessage += `- Could not add admin role. Has this role already been used?\n`;
                    throw error;
                }
            }
            const adminRoles = await prisma.userRole.findMany({
                where: {
                    server: server,
                    roleType: UserRoleType.Administrator,
                }
            });
            if (adminRoles.length > 0) {
                message += `- Admin roles: ${adminRoles.map(role => `<@&${role.discordId}>`).join(' ')}\n`;
            }

            console.log(message);
            message += `You can now call /addgame to add support for games you want on your server.\n`
            await interaction.editReply(message);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(errorMessage);
        }
    },
}

export = setupserverCommand;