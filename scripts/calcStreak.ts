import { isAfter, isBefore, subDays } from "date-fns";
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


  // to check streak for each user we first need to know to where we are checking (lastperiod normally)
  // if the user did not vote in the last period we can just reset streak all together

  // console.log(`checking if vote from ${user.votes[0].createdAt} is between ${range.lastPeriod.startDate} - ${range.lastPeriod.endDate}`);
  
  // if vote is after start and before end its in range
  const before = isBefore(new Date(user.votes[0].createdAt), new Date(range.lastPeriod.startDate));
  const after = isAfter(new Date(user.votes[0].createdAt), new Date(range.lastPeriod.endDate))


  if (before || after) {
    
    // means vote WAS NOT in range
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        streak: 0,
      },
    });
    console.log(`[STREAK] Resetting streak for ${user.name}`);
  }else{
    // vote WAS last period
    // now loop over each later vote and check if it is in range to last to increment streak
    let lastVotePeriodStart = range.currentPeriod.startDate
    // we got last start day so to figure out if we go back more to check streaks we need to get a new Start Period
    let newVotePeriodStart = getDateRange({offset: subDays(lastVotePeriodStart, 1)}) // passing last vote period should give us the one before back?
    
    let streak = 0
    let run = true
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
        newVotePeriodStart = getDateRange({offset: subDays(lastVotePeriodStart, 1)})
        lastVotePeriodStart = newVotePeriodStart.currentPeriod.startDate
        streak++
      }else{
        run = false
      }
      // we check if there is a vote for last period
    }
    await prisma.user.update({
      where:{
        id: user.id
      },
      data:{
        streak: streak
      }
    })
    // console.log("updateStreak",updateStreak);
    
  }
};

(() => {
  calcStreak();
})();
