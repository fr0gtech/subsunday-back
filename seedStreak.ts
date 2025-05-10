/**
 * Little script to help with streak deving
 * 
 * This goal should create a bunch of users with different streaks
 * 
 * We want users with invalid streaks (votes made a long time ago)
 * We want users with streaks incrementing (10 users first has 1 last has 10 votes)
 * 
 */

import { addDays, subDays } from "date-fns";
import { getDateRange } from "./app/lib";
import { prisma } from "./app/prisma";

const toCreate = {
    invalid: ['invalid1', "invalid2"],
    incrementing: {
        username: "invalid",
        count: 10
    }
}

const getDatesInRanges = (amount: 10) =>{
    const current = getDateRange()
    let votesDates: Date[] = []

    let lastStart = current.currentPeriod.startDate
    let run = true
    while (run) {
        const range = getDateRange({offset: subDays(lastStart, 1)})
        lastStart = range.currentPeriod.startDate
        votesDates.push(addDays(range.currentPeriod.startDate, 1))
        if (votesDates.length > amount){
            run = false
            return votesDates
        }
    }
    return votesDates
}

const seedStreak = async() =>{
    await prisma.game.upsert({
        where:{
            id: 0
        },
        create:{
            id: 0,
            steamId: 0,
            name: "dummy"
        },
        update:{

        }
    })
    const ranges = getDatesInRanges(10)
    // we need to get some dates to create the dummy votes
    // we need up to 10 dateRanges back
    const runId = Math.ceil(Math.random() * 100)
    // ok here we need to loop for each item so first loop over each item

    for (let index = 0; index < toCreate.incrementing.count; index++) {
        const amountOfVotes = index + 1
        const username = "incrementing - " + amountOfVotes
        const votes2createDate = ranges.slice(0, -(11 - amountOfVotes))
        const votes2create = votes2createDate.map((e, i)=>{return {
            gameName: 'increment - ' + i + ' - ' + runId,
            createdAt: e,
            for:{
                connect:{
                    id: 0
                }
            },
        }})
        const user = await prisma.user.create({
            data:{
                id: Math.ceil(Math.random() * 100),
                name: username,
                sub: false,
            }
        })
        votes2create.forEach(async (e)=>{
            await prisma.user.update({
                where:{
                    id: user.id
                },
                data:{
                    votes:{
                        create: {
                            for:{
                                connect:{
                                    id: 0
                                }
                            },
                            createdAt: e.createdAt,
                        }
                    }
                }
            })
        })
    }
}

seedStreak()

