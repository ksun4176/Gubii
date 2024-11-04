# Gubii
A discord bot used to handle guild management.
This handles everything from welcoming people to your server to guild applications to assigning out guild roles to much more.

## Table of Contents
- [Set up Discord Server](#set-up-discord-server)
- [Add Guilds](#add-guilds)
- [Go through Guild Applications](#go-through-guild-applications)
- [Other Guild Actions](#other-guild-actions)
   - [Transferring Guild Members](#transferring-members)
   - [Kicking Members](#kicking-members)
- [Apply to a Guild](#apply-to-a-guild)
- [Premium Functionality](#premium-functionality)
   - [/addservertriggers](#addservertriggers)
   - [/addgametriggers](#addgametriggers)
- [FAQs](#faqs)
- [File Structure](#file-structure)
- [Contributing](#contributing)

## Set up Discord Server
Can only be done by Server Owner
1. Add bot to server at [Gubii Authorization](https://discord.com/oauth2/authorize?client_id=1246175342918635530).
2. **Important** In Server Settings > Roles, move up the Gubii role to the top of the list. This allows it to assign out roles correctly.
3. Run `/setupserver`
   - (Optional) Add server admin role to give other users permission to manage the server
   - (Optional) Add bot log channel to log everything the bot does in your server
4. Assign out the admin role now so they can also run following commands
5. **(Recommended)** Run `/addservertriggers/` to add a welcome message for when people join the server
   - Placeholders
      - `<{user}>` : New member's discord tag
      - `<{serverName}>` : Name of server
      - `<{serverAdmin}>` : Server admin role
      - `[|apply|]` : Add the 'Apply to Guilds' button
   1. Draft up a welcome message (use the placeholders specified above)
   2. Run command with `event:ServerMemberAdd` and which channel to post message in
   3. Paste in your welcome message

## Add Guilds
Can only be done by Server Owner + Admins
1. Create a management role + member role for the game to be SHARED across all guilds (e.g. {Game Name} Management)
2. Run `/addgame` to let us know which games you are playing
   - This will create a recruitment thread channel (applications for management to review) and an applicant thread channel (applications for applicants to fill out)
   - (Optional) You can specify a channel category to put these new channels in.
   - If you do not see an option for the game you're playing, go to https://discord.gg/UEWzKAu3 and any admin there can help you
3. Create a management role + member role for the single guild specifically (e.g., {Guild Name} Member)
4. Run `/createguild` for each guild
5. **(Recommended)** Add an application for the game
   1. Draft up your application questions
   2. Run `/addgametriggers event:Apply`
   3. Paste in your application questions
6. Assign out the guild management role out for each guild
7. **(Recommended)** Assign out the server admin role to your guild leads
8. **(Recommended)** Run `/addgametriggers`to add more messages for when people get accepted to a guild or transfer to another one
   - Placeholders
      - `<{user}>` : New member's discord tag
      - `<{serverName}>` : Name of server
      - `<{serverAdmin}>` : Server admin role
      - `<{gameName}>` : Name of game
      - `<{guildName}>` : Name of guild
      - `<{guildManagement}>` : Guild management role
      - `<{guildMembers}>` : Guild member role
   1. Draft up the welcome message (use the placeholders specified above)
   2. Run command with `event:Accept/Transfer` and which channel to post message in
   3. Paste in your welcome message

## Go through Guild Applications
Can only be done by Guild Management
- When a user applies to a guild, an application thread will be spawned
1. To send a message to the applicant, you must mention @Gubii in the message.
   - Messages will be reacted with ✅ or ❌ to let you know if they were sent
   - This is so all of management can discuss the application here amongst themselves.
2. To accept an application, run `/application accept`
3. To decline an application, run `/application decline`

## Other Guild Actions
### Transferring Members
Can only be done by Guild Management
1. Run `/application accept` to transfer user to new guild
   - You will then be prompted to remove old guild roles for a full transfer

### Kicking Members
Can only be done by Guild Management
1. Run `/kickguild` to kick a user from guilds
   - You can specify just a single guild if needed

## Apply to a Guild
Can be done by anyone
1. Run `/application apply`
   - You can specify a guild to apply to directly
2. An application thread will be spawned
3. To send a message to the recruiter, you must mention @Gubii in the message.
   - Messages will be reacted with ✅ or ❌ to let you know if they were sent

## Premium Functionality
1. To become a premium server, go to https://discord.gg/UEWzKAu3 and talk to any admin
   1. Run `/addpremiumserver` to enable/disable premium membership


### `/schedulemessage`
- TBD

## FAQs


## File Structure
- `.env.example`: Example .env file to be filled in
- `Dockerfile`: Used to create a docker image of your bot so it can be easily exported
- `package.json` and `tsconfig.json`: These files are used to configure Node.js
- `src/`: This is where your bot code would live
   - `./app.ts`: Entrypoint of your bot
   - `./utils`: This contains files to help with set up of interactions from individual structure to registering/binding
   - `./buttons/*`: All of your button interactions
   - `./commands/*`: All of your commands
   - `./events/*`: All of your discord events
- All other files are auto generated so they do not need to be touched.

## Contributing
This server is built in Node.js.
The languages we are using are TypeScript.

To start a development bot:
1. Copy `../.env.example` to `.env` and fill it in for your discord bot
2. Copy over `../sql_database/prisma/schema.prisma` to `discord_bot` so the Prisma Client can build out correctly
3. Install node dependencies using `npm install`
4. Make sure your prisma client is up to date by running `npx prisma generate`.
5. Call `npm run register` to register your discord bot with your commands
   - If you change anything in a command definition, you will need to call this again.
5. Initiate a development server using `npm run dev`
   - This uses nodemon which will track real time updates to your changes and restart the server automatically
6. Once you get the `Ready! Logged in as <Discord Bot>`, your bot is online.

To verify that the docker container runs as expected, run these commands in terminal:
1. Rebuild container using `docker-compose -f docker-compose.yml up -d --build`
   - NOTE: Since Docker container is in its own separate network, `localhost` might not connect correctly.You can try your local machine's IP address and verifying the SQL credentials works from any connection.

### To update the AWS ECS container:
1. Find the AWS Elastic Container Registry for the discord bot.
2. Update `.env` with AWS RDS info.
3. Run the push commands to upload new docker image
   Example:
   - `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <repository-url>`
   - `docker build -t bot .`
   - `docker tag bot:latest <repository-url>/bot:latest`
   - `docker push <repository-url>/bot:latest`
4. Redeploy by calling `aws ecs update-service --cluster bot --service bot --force-new-deployment`