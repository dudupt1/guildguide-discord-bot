import {
  ActionRowBuilder,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';
import { config, requireRuntimeConfig } from './config.js';
import { handleClearWarningsCommand, handleWarnCommand, handleWarningsCommand } from './features/moderation.js';
import {
  createIdeaButton,
  handleSuggestionCommand,
  handleSuggestionModal,
  handleSuggestionStatusCommand,
  isSuggestionButton,
  isSuggestionModal,
  showSuggestionModal,
} from './features/suggestions.js';
import { handleLeaderboardCommand, handleProfileCommand, handleTaskCommand } from './features/tasks.js';
import {
  cancelTicketClose,
  confirmTicketClose,
  createTicketButton,
  handleTicketStats,
  isCancelCloseButton,
  isCloseTicketButton,
  isConfirmCloseButton,
  isTicketButton,
  isTicketOpenModal,
  openTicketFromModal,
  requestTicketClose,
  showTicketModal,
} from './features/tickets.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function canManageServer(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

async function publishControlPanel(interaction) {
  if (!canManageServer(interaction)) {
    await interaction.reply({ content: 'You need the Manage Server permission to publish this panel.', ephemeral: true });
    return;
  }

  if (!interaction.channel?.isTextBased()) {
    await interaction.reply({ content: 'Use this command in a text channel.', ephemeral: true });
    return;
  }

  const panel = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('GuildGuide community desk')
    .setDescription('Need help or have an idea? Choose an option below and GuildGuide will guide you.')
    .addFields(
      { name: '🎫 Private support', value: 'Open a channel visible only to you and the support team. A short intake form keeps requests clear.', inline: false },
      { name: '💡 Suggestions', value: 'Share an idea directly with the community. Staff can publish its review status.', inline: false },
    )
    .setFooter({ text: 'GuildGuide • Community utility bot' });

  const controls = new ActionRowBuilder().addComponents(createTicketButton(), createIdeaButton());
  await interaction.channel.send({ embeds: [panel], components: [controls] });
  await interaction.reply({ content: 'GuildGuide panel published successfully.', ephemeral: true });
}

async function routeCommand(interaction) {
  switch (interaction.commandName) {
    case 'setup':
      return publishControlPanel(interaction);
    case 'ticketstats':
      return handleTicketStats(interaction);
    case 'suggest':
      return handleSuggestionCommand(interaction);
    case 'suggestion':
      return handleSuggestionStatusCommand(interaction);
    case 'warn':
      return handleWarnCommand(interaction);
    case 'warnings':
      return handleWarningsCommand(interaction);
    case 'clearwarnings':
      return handleClearWarningsCommand(interaction);
    case 'task':
      return handleTaskCommand(interaction);
    case 'profile':
      return handleProfileCommand(interaction);
    case 'leaderboard':
      return handleLeaderboardCommand(interaction);
    default:
      return undefined;
  }
}

async function routeButton(interaction) {
  if (isTicketButton(interaction)) return showTicketModal(interaction);
  if (isCloseTicketButton(interaction)) return requestTicketClose(interaction);
  if (isConfirmCloseButton(interaction)) return confirmTicketClose(interaction);
  if (isCancelCloseButton(interaction)) return cancelTicketClose(interaction);
  if (isSuggestionButton(interaction)) return showSuggestionModal(interaction);
  return undefined;
}

async function routeModal(interaction) {
  if (isTicketOpenModal(interaction)) return openTicketFromModal(interaction);
  if (isSuggestionModal(interaction)) return handleSuggestionModal(interaction);
  return undefined;
}

async function replyToUnexpectedError(interaction) {
  const message = 'Something went wrong. Please try again or contact a server administrator.';

  if (interaction.deferred) {
    await interaction.editReply({ content: message }).catch(() => null);
  } else if (interaction.replied) {
    await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
  } else {
    await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`GuildGuide is online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.inGuild()) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: 'GuildGuide can only be used inside a server.', ephemeral: true });
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      await routeCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      await routeButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await routeModal(interaction);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    await replyToUnexpectedError(interaction);
  }
});

try {
  requireRuntimeConfig();
  client.login(config.token);
} catch (error) {
  console.error(`GuildGuide could not start: ${error.message}`);
  process.exitCode = 1;
}
