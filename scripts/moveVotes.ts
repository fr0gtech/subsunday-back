import { prisma } from "../app/prisma"

const fromGameId = 1;
const toGameId = 0;

(async()=>{
   const votes = await prisma.game.findFirst({
        where:{
            id: fromGameId
        },
        select:{
            votes: true
        }
    })
    votes?.votes.forEach(async(e) => {
        await prisma.vote.update({
            where:{
                id: e.id
            },
            data:{
                for:{
                    connect:{
                        id: toGameId
                    }
                }
            }
        })
    });
})()