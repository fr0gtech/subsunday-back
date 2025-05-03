import { onMessage } from ".";
import { delay } from "./lib";

const games = [
  "World of Goo 2",
  "Hades II",
  "Hollow Knight: Silksong",
  "Starfield",
  "The Legend of Zelda: Tears of the Kingdom",
  "Elden Ring",
  "Baldur's Gate 3",
  "Sea of Stars",
  "Dave the Diver",
  "Cyberpunk 2077",
  "The Witcher 3",
  "Fortnite",
  "League of Legends",
  "Minecraft",
  "Apex Legends",
  "Valorant",
  "Overwatch 2",
  "Super Mario Bros Wonder",
  "Resident Evil 4 Remake",
  "Final Fantasy XVI",
  "Persona 5 Royal",
  "Monster Hunter Rise",
  "Among Us",
  "Stardew Valley",
  "Dead Cells",
  "Cult of the Lamb",
  "Risk of Rain 2",
  "Slay the Spire",
  "Ghost of Tsushima",
  "God of War Ragnarok",
  "Spider-Man 2",
  "Lies of P",
  "Armored Core VI",
  "F-Zero 99",
  "Sonic Superstars",
  "Metroid Dread",
  "Cuphead",
  "Inside",
  "Celeste",
  "It Takes Two",
];

const usernames = [
  "gamer123",
  "speedrunner",
  "zeldaFan99",
  "proplayer",
  "noobmaster",
  "gamequeen",
  "pixelhero",
  "controllerking",
  "streamgod",
  "chatwarrior",
  "frostbyte",
  "pixelwizard",
  "ninjachad",
  "bossSlayer",
  "darkmage",
  "silentarrow",
  "rocketron",
  "hypernova",
  "midnightowl",
  "blitzkrieg",
  "toxicbunny",
  "grindmaster",
  "luckyshot",
  "soulcrusher",
  "ghostgamer",
  "couchpotato",
  "tryhardtimmy",
  "1hpclutch",
  "headshotqueen",
  "lagbeast",
  "aimbotwannabe",
  "criticalfail",
  "ultimatenoob",
  "afklegend",
  "fastfingers",
  "highpinghero",
  "carryqueen",
  "lobbyloser",
  "victoryroyal",
  "pressstart",
];
// add data while running

export function generateRandomRewardMsg() {
  const randomGame = games[Math.floor(Math.random() * games.length)];
  const randomUser = usernames[Math.floor(Math.random() * usernames.length)];
  const randomColor = `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
  const randomId = crypto.randomUUID();
  const randomUserId = Math.floor(Math.random() * 10000000).toString();

  return {
    msg: `!vote ${randomGame}`,
    userstate: {
      color: randomColor,
      "custom-reward-id": "b6dd266d-6855-4da4-88cb-8773a9ed76ad",
      "display-name": randomUser,
      emotes: null,
      "first-msg": Math.random() < 0.5,
      id: randomId,
      subscriber: Math.random() < 0.5,
      turbo: Math.random() < 0.5,
      "user-id": randomUserId,
      username: randomUser.toLowerCase(),
      "message-type": "chat",
    },
  };
}

(async () => {
  const rewardMessages = Array.from({ length: 100 }, generateRandomRewardMsg);
  for (const e of rewardMessages) {
    await onMessage(e.msg, e.userstate);
    await delay(100); // optional delay
  }
})();
