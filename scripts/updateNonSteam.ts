import { loadGames, updateGame } from "../app/lib";
import { prisma } from "../app/prisma"
import { Game } from "../generated/prisma";

export const updateGames = async () =>{
    await loadGames()
    const allGames = await prisma.game.findMany({
        where:{
            steamId: 0
        },
        select:{
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