"use strict";

const Hubot = require("hubot");
const Discord = require("discord.js");

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
    this.client.on("error", (err) => this.onError(err));

    this.login();
  }

  ensureUserData(id, room) {
    let user;
    const userData = this.client.users.get("id", id);
    const roomData = room.isPrivate ? this.client.privateChannels.get("id", room.id)
      : this.client.channels.get("id", room.id);

    if (userData) {
      user = this.robot.brain.userForId(userData.id, userData);
      this.robot.brain.data.users[ userData.id ].name = `<@${userData.id}>`;
      this.robot.brain.data.users[ userData.id ].room = `<#${roomData.id}>`;
      this.robot.brain.data.users[ userData.id ].roomName = roomData.name;
      this.robot.brain.data.users[ userData.id ].roomId = roomData.id;
      this.robot.brain.data.users[ userData.id ].pm = room.isPrivate;
    }
    return user;
  }

  login() {
    this.client.login(this.options.email, this.options.password);
  }

  onReady() {
    this.robot.logger.info('Logged in: ' + this.client.user.username);
    this.emit("connected");
  }

  onDisconnected() {
    this.robot.logger.info("Disconnected from server");
    this.login();
  }

  onError(err) {
    this.robot.logger.error("Connection error: %s", err);
    this.login();
  }

  onMessage(message) {
    console.log("here!!!!");
    
    /* ignore message from myself */
    if (this.client.user.id === message.author.id) return;

    let user = this.ensureUserData(message.author.id, message.channel);
    user.lastMessage = message;

    let text = message.content;
    for (let mention of message.mentions) {
      if (mention.id === this.client.user.id) {
        let re = new RegExp('<@' + mention.id + '>');
        text = text.replace(re, '@' + this.robot.name);
      }
    }

    console.log({
      user,
      text,
      message_id: message.id
    });
      
    this.receive(new Hubot.TextMessage(user, text, message.id));
  }

  onPresence(user, status, game_id) {
    this.robot.logger.info("user %s status=%s, game_id=%s", user.username, status, game_id);
  }

  send(envelope, ...messages) {
    console.log("*** send!");

    let m = envelope.room.match(/<#(.*?)>/);
    if (m.length < 2) return;

    const channelId = m[1];

    for (let msg of messages) {
      this.client.sendMessage(channelId, msg, {}, (err, msg) => {
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
