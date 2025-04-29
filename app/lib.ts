import {
  Day,
  nextDay,
  setMilliseconds,
  setSeconds,
  setMinutes,
  setHours,
  subDays,
} from "date-fns";
import { parse } from "node-html-parser";

type DateRangeOptions = {
  intervalDays: number;
  time: string;
  startDay: Day; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
};

export function getDateRange({
  intervalDays,
  time,
  startDay,
}: DateRangeOptions) {
  const [hour, minute] = time.split(":").map(Number);

  const now = new Date();
  const nextStartDay = nextDay(now, startDay);
  const endDate = setMilliseconds(
    setSeconds(setMinutes(setHours(nextStartDay, hour), minute), 0),
    0,
  );
  const startDate = subDays(endDate, intervalDays);

  return { startDate, endDate };
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
    const appId = parseInt(listItem?.attributes["data-ds-appid"] as string);
    return appId
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


