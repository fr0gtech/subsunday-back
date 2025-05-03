import { isBefore } from "date-fns";
import { prisma } from "./app/prisma";
import { User, Vote } from "./generated/prisma";
import { getDateRange } from "./app/lib";

// we run at the range cutoff time a streak function going over all users that are on a streak and check if they voted for that period
const calcStreak = async () => {
  // this would run at range edge - 10min or so
  const range = getDateRange();
  const usersToCheck = await prisma.user.findMany({
    where: {
      streak: {
        gt: 0,
      },
    },
    include: {
      votes: {
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  // loop over users that need to be checked
  for (const e of usersToCheck) {
    await checkStreak(e, range);
  }
};

const checkStreak = async (
  user: User & { votes: Vote[] },
  range: { startDate: any; endDate?: Date },
) => {
  const isOnStreak = isBefore(
    new Date(range.startDate),
    new Date(user.votes[0].createdAt),
  );
  if (isOnStreak) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        streak: {
          increment: 1,
        },
      },
    });
    console.log(`[STREAK] Adding +1 to streak for ${user.name}`);
  } else {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        streak: 0,
      },
    });
    console.log(`[STREAK] Resetting streak for ${user.name}`);
  }
};

(() => {
  calcStreak();
})();
