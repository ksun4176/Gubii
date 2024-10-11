/**
 * Learn more about the Seed Client by following our guide: https://docs.snaplet.dev/seed/getting-started
 */
import { createSeedClient } from "@snaplet/seed";
import { parseArgs } from 'node:util';

const main = async () => {
    const { values: { skipTest } } = parseArgs({ options: {
        skipTest: { type: 'boolean' }  
    } });

    const seed = await createSeedClient();

    // Truncate all tables in the database
    await seed.$resetDatabase();

    // Seed channel_purpose_types
    const channelPurposeTypes = [
        'Recruitment',
        'Applicant'
    ]
    await seed.channelPurposeType(channelPurposeTypes.map((type, index) => { return { id: index+1, name: type } }));

    // Seed user_role_types
    const userRoleTypes = [
        'Server Owner',
        'Administrator',
        'Guild Lead',
        'Guild Management',
        'Guild Member',
    ]
    await seed.userRoleType(userRoleTypes.map((type, index) => { return { id: index+1, name: type } }));
    // Seed games
    const games = [
        'AFK Arena'
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
            name: `Gubii Test Server ${ctx.index+1}`,
            discordId: `server${ctx.index+1}`
        })));
        for (const server of seed.$store.server) {
            // Seed server owner roles -> links between user + role
            const store = await seed.userRole([{
                name: `${server.name} Owner`,
                roleType: 1,
                serverId: server.id,
                discordId: `server${server.id}owner`
            }]);
            await seed.userRelation([{
                userId: server.id
            }],{
                connect: { userRole: [store.userRole[0]] }
            });
            // Seed server admin roles
            await seed.userRole([{
                name: `${server.name} Admin`,
                roleType: 2,
                serverId: server.id,
                discordId: `server${server.id}admin`
            }]);
            // Seed placeholder guilds
            await seed.guild([{
                gameId: Math.floor(Math.random() * games.length + 1),
                guildId: '', 
                name: 'GameGuildPlaceholder1', 
                serverId: server.id
            }]);
            // Seed test guilds
            await seed.guild((x) => x({min: 1, max: 3}, (ctx) => ({
                gameId: Math.floor(Math.random() * games.length + 1),
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
            // Seed guild lead roles
            await seed.userRole([{
                name: `${guild.name} Lead`,
                roleType: 3,
                serverId: guild.serverId,
                guildId: guild.id,
                discordId: `guild${guild.id}lead`
            }]);
            // Seed guild management roles
            await seed.userRole([{
                name: `${guild.name} Management`,
                roleType: 4,
                serverId: guild.serverId,
                guildId: guild.id,
                discordId: `guild${guild.id}manager`
            }]);
            // Seed guild member roles
            const store = await seed.userRole([{
                name: `${guild.name} Member`,
                roleType: 5,
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