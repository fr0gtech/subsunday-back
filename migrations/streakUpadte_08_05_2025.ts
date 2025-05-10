import { isAfter, isBefore } from "date-fns";
import { prisma } from "./app/prisma";
import { User, Vote } from "./generated/prisma";
import { getDateRange } from "./app/lib";

// This is a migration script becuase we are changing how streaks work
// we run this before deploying new streak logic
// this will update each users current streak
const calcStreak = async () => {
  const range = getDateRange();

  // we get each user with a streak and get last vote
  const usersToCheck = await prisma.user.findMany({
    where: {
      AND:[
        {
          streak: {gte: 0}
        },
        {
          votes:{
            some: {}
          }
        }
      ]
      
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
    await checkStreak(e, range.lastPeriod);
  }
};

const checkStreak = async (
  user: User & { votes: Vote[] },
  range: { startDate: Date; endDate: Date },
) => {

  // if vote is after start and before end its in range
  const before = isAfter(new Date(user.votes[0].createdAt), new Date(range.startDate));
  const after = isAfter(new Date(range.endDate), new Date(user.votes[0].createdAt))


  if (!before || !after) {
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
