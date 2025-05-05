import { onMessage } from ".";
import { seedGames, usernames } from "./data";
import { delay } from "./lib";

// add data while running

export function generateRandomRewardMsg() {
  const randomGame = seedGames[Math.floor(Math.random() * seedGames.length)];
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
