import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || null,
  supportRoleId: process.env.SUPPORT_ROLE_ID || null,
  suggestionChannelId: process.env.SUGGESTION_CHANNEL_ID || null,
  ticketLogChannelId: process.env.TICKET_LOG_CHANNEL_ID || null,
};

export function requireRuntimeConfig() {
  if (!config.token) {
    throw new Error('DISCORD_TOKEN is missing. Copy .env.example to .env and fill it in.');
  }
}

export function requireDeployConfig() {
  const missing = ['CLIENT_ID', 'GUILD_ID', 'DISCORD_TOKEN'].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}
