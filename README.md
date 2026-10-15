# GuildGuide — Discord Community Operations Bot

GuildGuide is a Discord community operations bot built with JavaScript, Node.js and discord.js. It provides structured support, community feedback, moderation records and member productivity tools through Discord interactions.

## Features

- Support panel with interactive Discord buttons.
- Private ticket channels created from structured modal submissions.
- Ticket close confirmation and optional transcript logging.
- Ticket workload statistics for server managers.
- Community suggestions with voting and review states.
- Moderation warning records with permission checks.
- Personal tasks, profiles and a completion leaderboard.

## Project Structure

```text
src/
├── features/
│   ├── moderation.js
│   ├── suggestions.js
│   ├── tasks.js
│   └── tickets.js
├── commands.js
├── config.js
├── deploy-commands.js
├── index.js
└── storage.js
```

## Setup

```bash
npm install
cp .env.example .env
npm run deploy
npm start
```

## Configuration

```env
DISCORD_TOKEN=your_private_token
CLIENT_ID=your_application_id
GUILD_ID=your_test_server_id
TICKET_CATEGORY_ID=
SUPPORT_ROLE_ID=
SUGGESTION_CHANNEL_ID=
TICKET_LOG_CHANNEL_ID=
```

`data.json` is created locally at runtime and is not committed to the repository.
