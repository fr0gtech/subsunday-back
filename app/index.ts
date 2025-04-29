import tmi, { ChatUserstate } from "tmi.js";
import "dotenv/config";
import { prisma } from "./prisma";
import { delay, getDateRange, getInfobyId, getSteamGameByName } from "./lib";
import { Server } from "socket.io";
import express from "express";
import { createServer } from "node:http";
import { demoMsg } from "./data";

const app = express(); // should use bun serve
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_ORIGIN,
  },
});

io.on("connection", (socket) => {
  socket.on("join", (data) => {
    socket.join(data);
  });
  socket.on("leave", (data) => {
    socket.leave(data);
  });
});

server.listen(3001, () => {
  console.log("server running at http://localhost:3001");
});

const CHANNEL = process.env.TWITCH_CHANNEL_NAME;
if (!CHANNEL) {
  console.error("Missing required env vars: TWITCH_CHANNEL_NAME");
  process.exit(1);
}
// // FOR DEVING
// (async () => {
//     // setInterval(() => {
//     //     io.to("main").emit("vote", {for: "Sea of Stars", from: "gaggi"})
//     //     console.log("send msg");
//     // }, 1000);
//     setTimeout(async()=>{
//         const randomId = demoMsg.sub.userstate
//         randomId["user-id"] = (Math.ceil(Math.random() * 1000)).toString()
//         await onMessage("!vote Vrising", randomId)
//         await delay(300);
//     }, 5000)
// })()

const client = new tmi.Client({
  channels: [CHANNEL],
});

client
  .connect()
  .then(() => {
    console.log(`listening on #${CHANNEL}`);
  })
  .catch(console.error);

client.on("message", (channel, userstate: ChatUserstate, message) => {
  onMessage(message, userstate);
});

export async function onMessage(message, userstate) {
  if (message.trim().startsWith("!vote")) {
    // only look at messages with !vote
    // if msg has reward id it has to be a vote with channel
    // points as long as streamer does not have other rewards
    // that user can input text into
    if (userstate["custom-reward-id"] && !userstate.subscriber) {
      // filter out subs to not duble trigger stuff
      const username = userstate.username;
      const game = message.trim().split("!vote")[1].trim();
      console.log(`[REWARD] ${username} issued !vote for ${game}`);
      registerVote(userstate, game);
    }

    if (userstate.subscriber) {
      const username = userstate.username;
      const game = message.trim().split("!vote")[1].trim();
      console.log(`[SUB] ${username} issued !vote for ${game}`);
      registerVote(userstate, game);
    }
  }
}

async function registerVote(userstate: ChatUserstate, gameMsg: string) {
  // look up or create user
  const user = await prisma.user.upsert({
    where: {
      id: parseInt(userstate["user-id"]) || 0,
    },
    create: {
      id: parseInt(userstate["user-id"]) || 0,
      name: userstate.username,
      sub: userstate.subscriber || false,
    },
    update: {},
  });

  // check if its a steam game
  // this is kinda dumb to do this for every req but we need to
  // know if its a steam game because of name matching with suggest...
    const appId = await getSteamGameByName(gameMsg)

  // var to set game object to
  let gameOnDb;
  if (!appId) {
    // check if its a steam game
    gameOnDb = await prisma.game.upsert({
      // if its not a steam game upsert the game
      where: {
        name: gameMsg,
      },
      create: {
        name: gameMsg,
        steamId: 0,
        picture: "default",
        link: "notOnSteam",
        description: "",
        website: "",
        price: [""],
        categories: {},
      },
      update: {},
    });
  } else {
    // if its a steam game get more info and upsert?
    // or maybe check first if we got before making another req?
    // 1 more req for us or one more for steam
    const steamAppDetails = await getInfobyId(appId)
    const moreInfo = steamAppDetails[appId].data;
    gameOnDb = await prisma.game.upsert({
      where: {
        name: moreInfo.name,
      },
      create: {
        name: moreInfo.name,
        picture: moreInfo.header_image || "",
        link: "",
        steamId: appId,
        description: moreInfo.short_description || "",
        website: moreInfo.website || "",
        dev: moreInfo.developers || [""],
        price: moreInfo.is_free ? {final: "free"} : moreInfo.price_overview || {final: "n/a"},
        categories: moreInfo.genres || {},
      },
      update: {},
    });
  }

  //vote if not already voted for this subsunday?
  const range = getDateRange({ intervalDays: 7, startDay: 0, time: "12:00" });

  const userCanVote = await prisma.user.findFirst({
    where: {
      id: user.id,
    },
    select: {
      _count: {
        select: {
          votes: {
            where: {
              createdAt: {
                gte: range.startDate,
                lte: range.endDate,
              },
            },
          },
        },
      },
    },
  });
  // user cannot vote now
  if (userCanVote?._count && userCanVote?._count.votes > 0) {
    console.log("user cannot vote");
    return;
  }
  // at last we create the vote
  await prisma.vote.create({
    data: {
      from: {
        connect: {
          id: user.id,
        },
      },
      for: {
        connect: {
          name: gameOnDb?.name || gameMsg,
        },
      },
    },
  });
  // also send ws messages to every room
  io.to("main")
    .to("game-" + gameOnDb.id)
    .to("user-" + user.id)
    .emit("vote", {
      for: {
        name: gameOnDb?.name || gameMsg,
        id: gameOnDb.id,
      },
      from: { name: user.name, id: user.id },
    });
}

