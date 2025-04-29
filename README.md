# Sub Sunday Backend

This is the backend of [sub-subday.com](https://sub-subday.com/) written in Bun.js. This reads chat via IRC and saves votes. It includes the [socket.io](http://socket.io) logic for realtime updates. `streak.ts` is ran from crontab every sunday at 23:59 to check for streaks.

## Frontend
The Frontend can be found [here](https://github.com/fr0gtech/subsunday-front)

## Features

- Realtime updates with [socket.io](https://socket.io/)
- IRC Twitch reader
- Get games from steam suggestion api

## Development

Check .env file

*requirements*:

- Bun.js
- postgresql
1. `bun install`
2. `bun index.ts`

## Seeding

For development purposes we have a `seed.ts` file to create fake votes

`bun seed.ts`