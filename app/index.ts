import "dotenv/config";
import { prisma } from "./prisma";
import { canUserVote, checkENV, createGameOnDb, delay, findClosestSteamGame, getDateRange, getGameOnDb, loadGames } from "./lib";
import { initSocket, io } from "./socket";
import { initTwitchIRC } from "./twitch";
import { ChatUserstate } from "tmi.js";
import { demoMsg, seedGames, usernames } from "./data";
import { TZDate } from "@date-fns/tz";
import { isAfter, isBefore } from "date-fns";

const CHANNEL = process.env.TWITCH_CHANNEL_NAME;

console.log(process.env.SOCKET_ORIGIN);
await init()

async function init(){
   checkENV(CHANNEL as string)
   loadGames()
    // runDev()
   initSocket()
   initTwitchIRC(CHANNEL)
}

export async function onMessage(message: string, userstate: ChatUserstate) {
  if (message.trim().startsWith("!vote")) {
    if (userstate["custom-reward-id"] && !userstate.subscriber) {
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

// this gets triggered if valid vote string
async function registerVote(userstate: ChatUserstate, gameMsg: string) {

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

  // check if user can vote
  const range = getDateRange();
  // check if we are out of period atm
  const now = new TZDate(new Date(), 'America/New_York');
  
  const isAfterEnd = isAfter(now, range.currentPeriod.endDate)
  if (isAfterEnd){
    console.log(`[SUB] ${user.name} cannot vote out of range, game: ${gameMsg}`);
    return;
  }
  const userCanVote = await canUserVote(user.id, range.currentPeriod);
  if (!userCanVote) {
    console.log(`[SUB] ${user.name} cannot vote, game: ${gameMsg}`);
    return;
  }

  // check if we got game on db with exact title match
  let gameOnDb = await getGameOnDb(gameMsg)

  // if we don't already have game do matching
  if (!gameOnDb) {
    // match game to a steam game
    const match = await findClosestSteamGame(gameMsg)
    // overwriet gameondb if null with new game data
    gameOnDb = await createGameOnDb(match, gameMsg)
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
  if (!gameOnDb) throw new Error("no game")
  // also send ws messages to every room
  io.to("main")
    .emit("vote", {
      for: {
        name: gameOnDb?.name || gameMsg,
        id: gameOnDb.id,
      },
      from: { name: user.name, id: user.id },
    });
}

// // FOR DEVING IGNORE THIS
function runDev(){
  setInterval(async()=>{
    const randomId = demoMsg.sub.userstate
    randomId["user-id"] = (Math.ceil(Math.random() * 10000)).toString()
    randomId.username = usernames[Math.floor(Math.random() * usernames.length)];

    await onMessage(`!vote ${seedGames[Math.floor(Math.random() * seedGames.length)]}`, randomId)
    await delay(300);
  }, 5000)
}
    //  setInterval(() => {
    //      io.to("main").emit("vote", {for: {name: "Sea of Stars", id: 123}, from: {name: "gaggi", id: 123}})
    //      console.log("send msg");
    //  }, 1000);

