import { ChannelType, ChatInputCommandInteraction, GuildTextBasedChannel, SlashCommandBuilder } from "discord.js";
import { BaseChatInputCommand, CommandLevel } from '../../utils/structures/BaseChatInputCommand';
import { Prisma } from "@prisma/client";
import { UserRoleType } from "../../helpers/DatabaseHelper";
import { scheduleJob } from "node-schedule";
import moment from "moment";

const options = {
  time: 'time',
  channel: 'channel'
}

export default class ScheduleMessageCommand extends BaseChatInputCommand {
  constructor() {
    const data = new SlashCommandBuilder()
      .setName('schedulemessage')
      .setDescription('Schedule a message to be sent')
      .addIntegerOption(option => 
        option.setName(options.time)
          .setDescription('the Unix epoch time to send message in')
          .setRequired(true)
      )
      .addChannelOption(option => 
        option.setName(options.channel)
          .setDescription('channel to send message')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      );
    super(CommandLevel.All, data);
  }
        
  override async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
        await interaction.reply('This command needs to be ran in a server');
        return;
    }
    await interaction.deferReply();
    const discordServer = interaction.guild;

    const time = interaction.options.getInteger(options.time)!;
    const channel = interaction.options.getChannel(options.channel)!;
    let errorMessage = 'There was an issue scheduling the message.';
    try {
      const { caller, databaseHelper } = await this.GetHelpers(interaction.user);

      const server = await databaseHelper.getServer(discordServer);
      const discordCaller = await discordServer.members.fetch(caller.discordId!);
      // check if server owner OR admin
      const roles: Prisma.UserRoleWhereInput[] = [
        { serverId: server.id, roleType: UserRoleType.ServerOwner },
        { serverId: server.id, roleType: UserRoleType.Administrator },
        { serverId: server.id, roleType: UserRoleType.GuildManagement }
      ]
      const hasPermission = await databaseHelper.userHasPermission(discordCaller, discordServer, roles);
      if (!hasPermission) {
        interaction.editReply('You do not have permission to run this command');
        return;
      }

      const scheduledTime = new Date(time);
      const timeCutoff = new Date();
      const timeCutoffMin = moment(timeCutoff).add(10,'minutes').toDate();
      const timeCutoffMax = moment(timeCutoff).add(2,'months').toDate();
      if (scheduledTime <= timeCutoffMin) {
        interaction.editReply(`You have to schedule at least 10 minutes ahead: ${scheduledTime.toUTCString()}`);
        return;
      }
      if (scheduledTime >= timeCutoffMax) {
        interaction.editReply(`You can only schedule messages for the next 2 months: ${scheduledTime.toUTCString()}`);
      }

      await interaction.editReply(`Your message will be scheduled for ${scheduledTime.toUTCString()}\n You can now enter the message you want to schedule (or type 'cancel'):\n`);
      try {
        const response = await interaction.channel.awaitMessages({
          filter: message => message.author.id === caller.discordId,
          max: 1,
          time: 600_000,
        });

        let messageText = response.first()!.content;
        if (!messageText || messageText.toLowerCase() === 'cancel') {
          await interaction.followUp('Message was not scheduled.');
          return;
        }

        scheduleJob(scheduledTime, async () => {
          if (!discordServer) return;
          const discordChannel = await discordServer.channels.fetch(channel.id);
          if (!discordChannel) return;
          await (discordChannel as GuildTextBasedChannel).send(messageText);
        });

        interaction.followUp(`Message has now been scheduled for ${scheduledTime.toUTCString()}`);
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
  }
}