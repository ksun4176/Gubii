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
    await seed.channel_purpose_type(channelPurposeTypes.map((type, index) => { return { id: index+1, name: type } }));

    // Seed user_role_types
    const userRoleTypes = [
        'Server Owner',
        'Administrator',
        'Guild Lead',
        'Guild Management',
        'Guild Member',
    ]
    await seed.user_role_type(userRoleTypes.map((type, index) => { return { id: index+1, name: type } }));
    // Seed games
    const games = [
        'AFK Arena'
    ]
    await seed.game(games.map((game, index) => { return { id: index+1, name: game } }));

    if (!skipTest) {
        // Seed users
        await seed.user((x) => x({ min: 20, max: 50 }, (ctx) => ({
            name: `User ${ctx.index+1}`,
            discord_id: `user${ctx.index+1}`
        })));
        const numUsers = seed.$store.user.length;
        // Seed servers
        await seed.server((x) => x({ min: 3, max: 9 }, (ctx) => ({
            name: `Gubii Test Server ${ctx.index+1}`,
            discord_id: `server${ctx.index+1}`
        })));
        for (const server of seed.$store.server) {
            // Seed server owner roles -> links between user + role
            const store = await seed.user_role([{
                name: `${server.name} Owner`,
                role_type: 1,
                server_id: server.id,
                discord_id: `server${server.id}owner`
            }]);
            await seed.user_relation([{
                user_id: server.id
            }],{
                connect: { user_role: [store.user_role[0]] }
            });
            // Seed server admin roles
            await seed.user_role([{
                name: `${server.name} Admin`,
                role_type: 2,
                server_id: server.id,
                discord_id: `server${server.id}admin`
            }]);
            // Seed placeholder guilds
            await seed.guild([{
                game_id: Math.floor(Math.random() * games.length + 1),
                guild_id: '', 
                name: 'GameGuildPlaceholder1', 
                server_id: server.id
            }]);
            // Seed test guilds
            await seed.guild((x) => x({min: 1, max: 3}, (ctx) => ({
                game_id: Math.floor(Math.random() * games.length + 1),
                guild_id: `${server.id}${ctx.index+1}`,
                name: `${server.id} Gubii Test Guild ${ctx.index+1}`, 
                server_id: server.id
            })));
        }

        let userCounter = 1;
        // Seed test guilds with guild roles
        for (const guild of seed.$store.guild) {
            // skip placeholders
            if (guild.guild_id === '') {
                continue;
            } 
            // Seed guild lead roles
            await seed.user_role([{
                name: `${guild.name} Lead`,
                role_type: 3,
                server_id: guild.server_id,
                guild_id: guild.id,
                discord_id: `guild${guild.id}lead`
            }]);
            // Seed guild management roles
            await seed.user_role([{
                name: `${guild.name} Management`,
                role_type: 4,
                server_id: guild.server_id,
                guild_id: guild.id,
                discord_id: `guild${guild.id}manager`
            }]);
            // Seed guild member roles
            const store = await seed.user_role([{
                name: `${guild.name} Member`,
                role_type: 5,
                server_id: guild.server_id,
                guild_id: guild.id,
                discord_id: `guild${guild.id}member`
            }]);
            if (userCounter <= numUsers) {
                await seed.user_relation([{
                    user_id: userCounter++
                }],{
                    connect: { user_role: [store.user_role[0]] }
                });
            }
        }
    }
    
    console.log("Database seeded successfully!");
    process.exit();
};

main();