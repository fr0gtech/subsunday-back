import {
  Day,
  nextDay,
  setMilliseconds,
  setSeconds,
  setMinutes,
  setHours,
  subDays,
  getDay,
  previousDay,
} from "date-fns";
import { parse } from "node-html-parser";
import Fuse from 'fuse.js'
import { prisma } from "./prisma";
import { TZDate, tz } from "@date-fns/tz";
import { Game } from "../generated/prisma";

export type SteamGame = {
  appid: number;
  name: string;
};
export let games: SteamGame[];

type DateRangeOptions = {
  _fromDay?: Day;
  _fromTime?: string;
  _toDay?: Day;
  _toTime?: string; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  offset?: Date;
};

export async function loadGames(){
  games = await getSteamGames()
}
export function getDateRange(options?: DateRangeOptions) {
  const { _fromDay, _fromTime, _toDay, _toTime, offset } = options || {};

  const fromDay = (_fromDay || process.env.FROM_DAY) as Day;
  const fromTime = (_fromTime || process.env.FROM_TIME) as string;
  const toDay = (_toDay || process.env.TO_DAY) as Day;
  const toTime = (_toTime || process.env.TO_TIME) as string;

  const now = new TZDate(offset || new Date(), process.env.TZ);
  const [fromHour, fromMinute] = fromTime.split(':').map(Number);

  const periodStart =
    getDay(now) == fromDay ? now : previousDay(now, fromDay, { in: tz(process.env.TZ as string) });

  const startDate = setMilliseconds(
    setSeconds(setMinutes(setHours(periodStart, fromHour), fromMinute), 0),
    0,
  );

  const [toHour, toMinute] = toTime.split(':').map(Number);

  // relative from start we get the next day
  const periodEndDate = nextDay(periodStart, toDay, { in: tz(process.env.TZ as string) });
  const endDate = setMilliseconds(
    setSeconds(setMinutes(setHours(periodEndDate, toHour), toMinute), 0),
    0,
  );

  const nextStart = nextDay(periodEndDate, fromDay, { in: tz(process.env.TZ as string) });

  const nextStartDate = setMilliseconds(
    setSeconds(setMinutes(setHours(nextStart, fromHour), fromMinute), 0),
    0,
  );
  // if its sunday we want to use the last Period to fetch items and display data?
  return {
    currentPeriod: {
      startDate,
      endDate,
      nextStartDate,
    },
    isSunday: getDay(now) == 0,
    lastPeriod: {
      startDate: subDays(startDate, 7),
      endDate: subDays(endDate, 7),
      nextStartDate: subDays(nextStartDate, 7),
    },
  };
}
export const getGameOnDb = async(gameMsg: string, steamId: string) =>{
  return await prisma.game.findFirst({
    where: steamId ? { steamId: parseInt(steamId) } :  { name: gameMsg }
  })
}
export const updateGame = async (gameOnDb: Game | null) => {
  
  if (!gameOnDb) return
  let steamId = gameOnDb.steamId
  if (gameOnDb.steamId <= 0){
    const closesSteam = await findClosestSteamGame(gameOnDb.name)
    if (closesSteam.appId) {
      steamId = closesSteam.appId
    }else{
      return;
    }
  }
  // we got a game on db but need to update it with steam info if we got any new ones
  const steamAppDetails = await getInfobyId(steamId)
  const moreInfo = steamAppDetails[steamId].data;
  if (steamAppDetails){
    await prisma.game.update({
      where:{
        name: gameOnDb.name
      },
      data:{
        name: moreInfo.name,
        picture: moreInfo.header_image || "",
        link: "",
        steamId: steamId,
        description: moreInfo.short_description || "",
        website: moreInfo.website || "",
        dev: moreInfo.developers || [""],
        price: moreInfo.is_free ? {final: "free"} : moreInfo.price_overview || {final: "n/a"},
        categories: moreInfo.genres || {},
      }
    })
  }
}
export const createGameOnDb = async (match: { name: string; appId: number | null; }, gameMsg: string) =>{
  if (!match.appId) {
    return prisma.game.upsert({
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
        createdAt: new TZDate(new Date(), process.env.TZ)
      },
      update: {},
    });
  } else {
    const steamAppDetails = await getInfobyId(match.appId)
    const moreInfo = steamAppDetails[match.appId].data;
    if (!moreInfo || !steamAppDetails[match.appId].success){
      // if we get a game like lol that is on steam game list but we cant get detail page just call itself with no appid
      return createGameOnDb({ appId: null, name: match.name }, gameMsg)
    }
    
    return await prisma.game.upsert({
      where: {
        name: moreInfo.name,
      },
      create: {
        name: moreInfo.name,
        picture: moreInfo.header_image || "",
        link: "",
        steamId: match.appId,
        description: moreInfo.short_description || "",
        website: moreInfo.website || "",
        dev: moreInfo.developers || [""],
        price: moreInfo.is_free ? {final: "free"} : moreInfo.price_overview || {final: "n/a"},
        categories: moreInfo.genres || {},
        createdAt: new TZDate(new Date(), process.env.TZ)
      },
      update: {},
    });
  }
}


export function getSteamAppIdFromURL(url) {
  const regex = /^https?:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/|$)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
export async function canUserVote(id: number, range: { startDate: any; endDate: any; }){
   const userCanVote = await prisma.user.findFirst({
      where: {
        id: id,
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
    
    return !(userCanVote?._count && userCanVote?._count.votes > 0)
}

export async function findClosestSteamGame(userInput) {
  const fuse = new Fuse(games, {
    keys: ['name'],
    threshold: 0.1, // lower is stricter make this lower if we get mismatches otherwise write own logic
  });

  const result = fuse.search(userInput);
  
  if (result.length > 0) {
    const { item } = result[0];
    return {
      name: item.name,
      appId: item.appid,
    };
  } else {
    return {
      name: "",
      appId: null
    };
  }
}

export async function igdbSearch(gameMsg: string){
  const body = {
    operationName: 'GetAutocompleteSuggestions',
    variables: { search: 'test' },
    query: 'query GetAutocompleteSuggestions($search: String!, $limit: Int, $gamesOnly: Boolean) {\n' +
      '  autocomplete(search: $search, limit: $limit, gamesOnly: $gamesOnly) {\n' +
      '    options {\n' +
      '      id\n' +
      '      value\n' +
      '      modelType\n' +
      '      cloudinary\n' +
      '      url\n' +
      '      text\n' +
      '      categoryName\n' +
      '      year\n' +
      '      firstReleaseDate\n' +
      '      name\n' +
      '      isExact\n' +
      '      __typename\n' +
      '    }\n' +
      '    __typename\n' +
      '  }\n' +
      '}'
  }
  await fetch("https://www.igdb.com/gql", {
    "credentials": "include",
    "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "content-type": "application/json",
        "Alt-Used": "www.igdb.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Priority": "u=0",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
    },
    "referrer": "https://www.igdb.com/",
    "body": JSON.stringify(body),
    "method": "POST",
    "mode": "cors"
});
}

export async function getSteamGameByName(gameMsg: string){
  const fromSteam = await fetch(
      "https://store.steampowered.com/search/suggest?term=" +
        gameMsg +
        "&f=games&cc=us&realm=1&l=english&v=28686041&excluded_content_descriptors%5B%5D=3&excluded_content_descriptors%5B%5D=4&use_store_query=1&use_search_spellcheck=1&search_creators_and_tags=1",
    ).then((e) => e.text());
  
    const root = parse(fromSteam);
 
    const listItem = root.querySelector(".match");
    const link = listItem?.attributes.href || "notOnSteam";
    const name = listItem?.querySelector(".match_name")?.text
    const appId = parseInt(listItem?.attributes["data-ds-appid"] as string);

    if (name?.toLowerCase().startsWith(gameMsg.toLowerCase())){
      // make sure the game start with the text, maybe not the best but should help with matching
      return appId
    }
    return null
}

export async function getInfobyId(appId: number){
  return await fetch(
      "https://store.steampowered.com/api/appdetails?appids=" +
        appId +
        "&cc=us",
    ).then((e) => e.json());
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSteamGames(): Promise<SteamGame[]> {
  const response = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
  const data = await response.json();
  return data.applist.apps;
}

export async function checkENV(CHANNEL){
  if (!CHANNEL) {
    console.error("Missing required env vars: TWITCH_CHANNEL_NAME");
    process.exit(1);
  }
}