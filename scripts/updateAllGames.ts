import { loadGames, updateGame } from "../app/lib";
import { prisma } from "../app/prisma"
import { Game } from "../generated/prisma";

export const updateGames = async () =>{
    await loadGames()
    const allGames = await prisma.game.findMany({
        select:{
            steamId: true,
            name: true
        }
    })
    
    allGames.forEach(async (e : any)=>{
        await updateGame(e)
    })

}

(()=>{
    updateGames()
})()