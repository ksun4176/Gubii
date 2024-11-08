/**
 * Learn more about the Seed Client by following our guide: https://docs.snaplet.dev/seed/getting-started
 */
import { UserRoleType } from "@prisma/client";
import { createSeedClient } from "@snaplet/seed";
import { parseArgs } from 'node:util';

const main = async () => {
    const { values: { skipTest } } = parseArgs({ options: {
        skipTest: { type: 'boolean' }  
    } });

    const seed = await createSeedClient();

    // Truncate all tables in the database
    await seed.$resetDatabase();

    // Seed games
    const games = [
        'AFK Arena',
        'AFK Journey'
    ]
    await seed.game(games.map((game, index) => { return { id: index+1, name: game } }));

    if (!skipTest) {
        // Seed users
        await seed.user((x) => x({ min: 20, max: 50 }, (ctx) => ({
            name: `User ${ctx.index+1}`,
            discordId: `user${ctx.index+1}`
        })));
        const numUsers = seed.$store.user.length;
        // Seed servers
        await seed.server((x) => x({ min: 3, max: 9 }, (ctx) => ({
            name: `Gubii Test Server ${ctx.index+1}`
        })));
        for (const server of seed.$store.server) {
            // Seed server owner roles -> links between user + role
            const store = await seed.userRole([{
                name: `${server.name} Owner`,
                role_type: UserRoleType.ServerOwner,
                serverId: server.id,
                discordId: `server${server.id}owner`
            }]);
            await seed.userRelation([{
                userId: server.id
            }],{
                connect: { userRole: [store.userRole[0]] }
            });
            const gameIndex = Math.floor(Math.random() * games.length + 1);
            // Seed placeholder guilds
            await seed.guild([{
                gameId: gameIndex,
                guildId: '', 
                name: games[gameIndex], 
                serverId: server.id
            }]);
            // Seed test guilds
            await seed.guild((x) => x({min: 1, max: 3}, (ctx) => ({
                gameId: gameIndex,
                guildId: `${server.id}${ctx.index+1}`,
                name: `${server.id} Gubii Test Guild ${ctx.index+1}`, 
                serverId: server.id
            })));
        }

        let userCounter = 1;
        // Seed test guilds with guild roles
        for (const guild of seed.$store.guild) {
            // skip placeholders
            if (guild.guildId === '') {
                continue;
            }
            // Seed guild management roles
            await seed.userRole([{
                name: `${guild.name} Management`,
                role_type: UserRoleType.GuildManagement,
                serverId: guild.serverId,
                guildId: guild.id,
                discordId: `guild${guild.id}manager`
            }]);
            // Seed guild member roles
            const store = await seed.userRole([{
                name: `${guild.name} Member`,
                role_type: UserRoleType.GuildMember,
                serverId: guild.serverId,
                guildId: guild.id,
                discordId: `guild${guild.id}member`
            }]);
            if (userCounter <= numUsers) {
                await seed.userRelation([{
                    userId: userCounter++
                }],{
                    connect: { userRole: [store.userRole[0]] }
                });
            }
        }
    }
    
    console.log("Database seeded successfully!");
    process.exit();
};

main();