import { getDateRange, loadGames, updateGame } from "../app/lib";
import { prisma } from "../app/prisma"

export const updateGames = async () =>{
    const range = getDateRange()
    await loadGames()
    const allGames = await prisma.game.findMany({
        where:{
            createdAt:{
                gte: range.currentPeriod.startDate,
                lte: range.currentPeriod.endDate
            }
        },
        select:{
            steamId: true,
            name: true
        },
        orderBy:{
            name: "asc"
        }
    })
    console.log("loaded " + allGames.length + " games");
    
    allGames.forEach(async (e : any, i: number)=>{
        console.log("updating game" + " " + i + " " + e.name);
        await updateGame(e)
    })

}

(()=>{
    updateGames()
})()