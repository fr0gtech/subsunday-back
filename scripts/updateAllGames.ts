import { loadGames, updateGame } from "../app/lib";
import { prisma } from "../app/prisma"

export const updateGames = async () =>{
    await loadGames()
    const allGames = await prisma.game.findMany({
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