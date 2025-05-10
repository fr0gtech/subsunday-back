import { isBefore, subDays } from "date-fns";
import { prisma } from "../app/prisma";
import { User, Vote } from "../generated/prisma";
import { getDateRange } from "../app/lib";

// this will help us if we fuck up streaks we can just run this and this will calc correct streak for each user
const calcStreak = async () => {
  const range = getDateRange();

  // we get each user that has votes and take the last
  const usersToCheck = await prisma.user.findMany({
    where: {
      votes:{
        some: {}
      }
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
  range:{ currentPeriod: { startDate: Date; endDate: Date }, lastPeriod: {startDate: Date, endDate: Date} },
) => {
  const before = isBefore(new Date(user.votes[0].createdAt), new Date(range.lastPeriod.startDate));
  if (before) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        streak: 0,
      },
    });
    // console.log(`[STREAK] Resetting streak for ${user.name}`);
  }else{

    let lastVotePeriodStart = range.currentPeriod.endDate
    let newVotePeriodStart = getDateRange({offset: subDays(lastVotePeriodStart, 1)})
    let streak = 0
    let run = true
    let firstRun = true
    while (run){
      const gotVote = await prisma.vote.findFirst({
        where:{
          from:{
            id: user.id
          },
          createdAt:{
            gte: newVotePeriodStart.currentPeriod.startDate,
            lte: newVotePeriodStart.currentPeriod.endDate
          }
        },
      })
      if (gotVote){
        // console.log(`user ${user.name} got a vote(${gotVote.id}) for this period`);
        lastVotePeriodStart = newVotePeriodStart.currentPeriod.startDate
        newVotePeriodStart = getDateRange({offset: subDays(lastVotePeriodStart, 1)})
        streak++
      }else if (firstRun && lastVotePeriodStart === range.currentPeriod.endDate){    
        firstRun = false
        lastVotePeriodStart = newVotePeriodStart.currentPeriod.startDate
        newVotePeriodStart = getDateRange({offset: subDays(lastVotePeriodStart, 1)})
      }else{
        run = false
      }
    }
    await prisma.user.update({
      where:{
        id: user.id
      },
      data:{
        streak: streak
      }
    })
  }
};

(() => {
  calcStreak();
})();
