import { createServer } from "http";
import { Server } from "socket.io";

const server = createServer();

export const io = new Server(server, {
    cors: {
        origin: process.env.SOCKET_ORIGIN,
    },
});

export const initSocket = () => {
    io.on("connection", (socket) => {
        socket.on("join", (data) => {
            socket.join(data);
        });
        socket.on("leave", (data) => {
            socket.leave(data);
        });
    });

    server.listen(process.env.SOCKET_PORT, () => {
        console.log(`socket running on ${process.env.SOCKET_PORT}`);
    });
}