# Gubii
A discord bot used to handle guild management.
This handles everything from welcoming people to your server to guild applications to assigning out guild roles.

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
2. **<u>Important</u>** In Server Settings > Roles, move up the Gubii role to the top of the list. This allows it to assign out roles correctly.
3. Run `/setupserver`
   - (Optional) Add server admin role to give other users permission to manage the server
   - (Optional) Add bot log channel to log everything the bot does in your server
4. Assign out the admin role now so they can also run following commands
5. **(Premium Only)** Add a welcome message for when people join the server. Read more about this in the **<u>Premium Functionality</u>** section

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
8. **(Premium Only)** Add a welcome message for when people get accepted. Read more about this in the **<u>Premium Functionality</u>** section

## Go through Guild Applications
Can only be done by Guild Management
- When a user applies to a guild, an application thread will be spawned
1. To send a message to the applicant, <u>you must mention @Gubii in the message</u>.
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
3. To send a message to the recruiter, <u>you must mention @Gubii in the message</u>.
   - Messages will be reacted with ✅ or ❌ to let you know if they were sent

## Premium Functionality
1. To become a premium server, go to https://discord.gg/UEWzKAu3 and talk to any admin
   1. Run `/addpremiumserver`
   2. Redeploy the commands so that the server gets all the new functionality

### `/addservertriggers`

- **<u>Add a welcome message for when people join the server</u>**
   - <u>Placeholders</u>
      - `<{user}>` : New member's discord tag
      - `<{serverName}>` : Name of server
      - `<{serverAdmin}>` : Server admin role
      - `[|apply|]` : Add the 'Apply to Guilds' button
   1. Draft up a welcome message (use the placeholders specified above)
   2. Run command with `event:ServerMemberAdd` and which channel to post message in
   3. Paste in your welcome message

### `/addgametriggers`
- **<u>Add a message for when people get accepted to a guild or transfer to another one</u>**
   - <u>Placeholders</u>
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

## FAQs


## File Structure
All development files can be found in `src/`. All other folders are auto generated so they do not need to be touched.

- ./app.ts: Entrypoint of our bot
- ./*[Interface/Helper].ts: General set up functions and typings
- ./buttons/*: All of our button interactions
- ./commands/*: All of our commands (NOTE: our code look at all commands in this directory and subdirectory level deeper)
- ./events/*: All of our events (NOTE: our code looks at all events at this level only)

## Contributing
This server is built in Node.js.
The languages we are using are TypeScript.

To start a development bot, run these commands in terminal:
1. Copy over `../sql_database/prisma/schema.prisma` to `discord_bot` so the Prisma Client can build out correctly
2. Install node dependencies using `npm install`
3. Make sure your prisma client is up to date by running `npx prisma generate`.
4. Initiate a development server using `npm run dev`
   - This uses nodemon which will track real time updates to your TypeScript + JSON and restart the server accordingly. 

If you change the command definition (description, options, etc.), you will need to redeploy:
(NOTE: You do not need to redeploy if you make updates to the execute function)
1. Deploy commands using `npm run register`
   - Node does not run on TypeScript so we need to create the corresponding JavaScript files before registering commands

To verify that the docker container runs as expected, run these commands in terminal:
1. Rebuild container using `docker-compose -f docker-compose.yml up -d --build`
   NOTE: Since Docker container is in separate network, DB_HOST needs to be set to your local machine's IP address to work properly. You would also need to make sure the login works from any connection.
2. Access your server and verify changes

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