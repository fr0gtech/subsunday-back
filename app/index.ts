import "dotenv/config";
import { prisma } from "./prisma";
import { checkENV, createGameOnDb, delay, findClosestSteamGame, getDateRange, getGameOnDb, getSteamAppIdFromURL, loadGames, updateGame } from "./lib";
import { initSocket, io } from "./socket";
import { initTwitchIRC } from "./twitch";
import { ChatUserstate } from "tmi.js";
import { demoMsg, usernames } from "./data";
import { TZDate } from "@date-fns/tz";
import { isAfter, isBefore, subDays } from "date-fns";

const CHANNEL = process.env.TWITCH_CHANNEL_NAME;

console.log(process.env.SOCKET_ORIGIN);
await init()

async function init(){
   checkENV(CHANNEL as string)
   await loadGames()
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
  // get current vote range
  const range = getDateRange();
  const user = await prisma.user.upsert({
    where: {
      id: parseInt(userstate["user-id"]) || 0,
    },
    create: {
      id: parseInt(userstate["user-id"]) || 0,
      name: userstate.username,
      sub: userstate.subscriber || false,
      createdAt: new TZDate(new Date(), process.env.TZ)
    },
    update: {},
    include:{
      votes:{
        take: 1,
        where:{
          createdAt: {
            gte: range.currentPeriod.startDate,
            lte: range.currentPeriod.endDate,
          },
        },
        orderBy:{
          createdAt: "desc"
        }
      }
    }
  });

  // check if we are out of period atm
  const now = new TZDate(new Date(), process.env.TZ);
  
  const isAfterEnd = isAfter(now, range.currentPeriod.endDate)
  if (isAfterEnd){
    console.log(`[SUB] ${user.name} cannot vote out of range, game: ${gameMsg}`);
    return;
  }
  // https://github.com/fr0gtech/subsunday-back/issues/1
  // a user vote should change if already votes no need to check if already voted
  // const userCanVote = await canUserVote(user.id, range.currentPeriod);
  // if (!userCanVote) {
  //   console.log(`[SUB] ${user.name} cannot vote, game: ${gameMsg}`);
  //   return;
  // }

  // parse vote if not just game name
    // some vote with a steam link so maybe support that?
    // not sure what else should be supported
  let idFromLink = getSteamAppIdFromURL(gameMsg)

  // check if we got game on db with exact title match
  let gameOnDb = await getGameOnDb(gameMsg, idFromLink)

  // if we got game check when it last was updated
  
  // if game is older than x we update its contents
  if (isBefore(gameOnDb?.updatedAt as Date, subDays(new Date(), 1)) && gameOnDb){
    // update game on db data
    await updateGame(gameOnDb)
  }

  // if we don't already have game do matching
  if (!gameOnDb) {
    // match game to a steam game
    const match = idFromLink ? { name: "", appId: parseInt(idFromLink)} : await findClosestSteamGame(gameMsg)
    // overwrite gameondb if null with new game data
    gameOnDb = await createGameOnDb(match, gameMsg)
  }

  // at last we create the vote
  if(user.votes[0]){
    await prisma.vote.update({
      where:{
        id: user.votes[0].id
      },
      data:{
        updatedAt: new TZDate(new Date(), process.env.TZ),
        for:{
          connect:{
            name: gameOnDb?.name || gameMsg,
          }
        }
      }
    })

    io.to("main")
    .emit("voteUpdate", {
      for: {
        name: gameOnDb?.name || gameMsg,
        id: gameOnDb?.id,
      },
      from: { name: user.name, id: user.id },
    });

  }else{
    // update user to have vote so we are able to increment streak here
    await prisma.user.update({
      where:{
        id: user.id
      },
      data:{
        streak: {increment: 1},
        votes:{
          create:{
            for:{
              connect:{
                name: gameOnDb?.name
              }
            },
            createdAt: new TZDate(new Date(), process.env.TZ),
          }
        }
      }
    })
   
    io.to("main")
    .emit("vote", {
      for: {
        name: gameOnDb?.name || gameMsg,
        id: gameOnDb?.id,
      },
      from: { name: user.name, id: user.id },
    });
  }
  if (!gameOnDb) throw new Error("no game")
  // also send ws messages to every room

}

// // FOR DEVING IGNORE THIS
function runDev(){
  setInterval(async()=>{
    const randomId = demoMsg.sub.userstate
    randomId["user-id"] = (Math.ceil(Math.random() * 10000)).toString()
    randomId.username = usernames[Math.floor(Math.random() * usernames.length)];

    await onMessage(`!vote https://store.steampowered.com/app/578080/PUBG_BATTLEGROUNDS/`, randomId)
    await delay(300);
  }, 5000)
}
    //  setInterval(() => {
    //      io.to("main").emit("vote", {for: {name: "Sea of Stars", id: 123}, from: {name: "gaggi", id: 123}})
    //      console.log("send msg");
    //  }, 1000);

