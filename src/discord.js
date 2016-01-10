"use strict";

const Hubot = require("hubot");
const Discord = require("discord.js")

class DiscordAdapter extends Hubot.Adapter {
  constructor(robot) {
    super(robot);
  }

  run() {
    this.options = {
      email: process.env.HUBOT_DISCORD_EMAIL,
      password: process.env.HUBOT_DISCORD_PASSWORD
    };
    
    this.client = new Discord.Client();
    this.client.on("ready", () => this.onReady());
    this.client.on("message", (message) => this.onMessage(message));
    this.client.on("disconnected", () => this.onDisconnected());
    this.client.on("presence", (user, status, game_id) => this.onPresence(user, status, game_id));

    this.client.login(this.options.email, this.options.password);
  }

  ensureUserData(id, room) {
    let user;
    const userData = this.client.users.get("id", id);
    const roomData = room.isPrivate ? this.client.privateChannels.get("id", room.id)
      : this.client.channels.get("id", room.id);

    if (userData) {
      user = this.robot.brain.userForId(userData.id, userData);
      this.robot.brain.data.users[ userData.id ].name = userData.username;
      this.robot.brain.data.users[ userData.id ].room = roomData.name;
      this.robot.brain.data.users[ userData.id ].pm = room.isPrivate;
    }
    return user;
  }

  onReady() {
    this.robot.logger.info('Logged in: ' + this.client.user.username);
    this.emit("connected");
  }

  onDisconnected() {
    this.robot.logger.info("Disconnected from server");
    this.client.login(this.options.email, this.options.password);
  }

  onMessage(message) {
    /* ignore message from myself */
    if (this.client.user.id === message.author.id) return;

    let user = this.ensureUserData(message.author.id, message.channel);
    user.lastMessage = message;

    let text = message.content;
    for (let mention of message.mentions) {
      let re = new RegExp('<@' + mention.id + '>');
      text = text.replace(re, '@' + mention.username);
    }
    
    this.receive(new Hubot.TextMessage(user, text, message.id));
  }

  onPresence(user, status, game_id) {
    this.robot.logger.info("user %s status=%s, game_id=%s", user.username, status, game_id);
  }

  send(envelope, ...messages) {
    let channelData = this.client.channels.getAll("name", envelope.room);
    if (!channelData || channelData.length === 0) 
      channelData = this.client.privateChannels.getAll("name", envelope.room);

    if (!channelData || channelData.length === 0) {
      this.robot.logger.error("cannot find channel object for %s", envelope.room);
      return;
    }

    for (let msg of messages) {
      this.client.sendMessage(channelData[0], msg, {}, (err, msg) => {
        if (err) {
          this.robot.logger.error("msg sent error: %s", err);
        }
      });
    }
  }

  reply(envelope, ...messages) {
    this.send(envelope, messages.map(m => `<@${envelope.user.id}> ${m}`));
  }
}

exports.use = robot => new DiscordAdapter(robot);
