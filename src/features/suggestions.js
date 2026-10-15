import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { config } from '../config.js';
import { getData, updateData } from '../storage.js';

const IDEA_BUTTON_ID = 'guildguide:idea';
const IDEA_MODAL_ID = 'guildguide:idea-modal';

const statusConfig = {
  'under-review': { label: 'Under review', color: 0x5865f2, emoji: '🔎' },
  planned: { label: 'Planned', color: 0xfee75c, emoji: '🗓️' },
  implemented: { label: 'Implemented', color: 0x57f287, emoji: '✅' },
  declined: { label: 'Declined', color: 0xed4245, emoji: '⛔' },
};

function makeSuggestionEmbed(authorId, idea, record = {}) {
  const status = statusConfig[record.status] ?? statusConfig['under-review'];
  const fields = [
    { name: 'Submitted by', value: `<@${authorId}>`, inline: true },
    { name: 'Review status', value: `${status.emoji} ${status.label}`, inline: true },
  ];

  if (record.reviewNote) {
    fields.push({ name: 'Staff note', value: record.reviewNote, inline: false });
  }

  return new EmbedBuilder()
    .setColor(status.color)
    .setTitle('Community suggestion')
    .setDescription(idea)
    .addFields(fields)
    .setFooter({ text: 'Vote with 👍 or 👎 • Staff can update the review status.' })
    .setTimestamp(record.createdAt ? new Date(record.createdAt) : new Date());
}

export function createIdeaButton() {
  return new ButtonBuilder()
    .setCustomId(IDEA_BUTTON_ID)
    .setLabel('Share an idea')
    .setEmoji('💡')
    .setStyle(ButtonStyle.Secondary);
}

export function showSuggestionModal(interaction) {
  const modal = new ModalBuilder().setCustomId(IDEA_MODAL_ID).setTitle('Submit a suggestion');
  const field = new TextInputBuilder()
    .setCustomId('idea-text')
    .setLabel('What would make this community better?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe the idea and why it would help.')
    .setMinLength(8)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(field));
  return interaction.showModal(modal);
}

async function resolveSuggestionChannel(guild, fallbackChannel) {
  if (!config.suggestionChannelId) {
    return fallbackChannel;
  }

  const configuredChannel = await guild.channels.fetch(config.suggestionChannelId).catch(() => null);
  return configuredChannel?.isTextBased() ? configuredChannel : fallbackChannel;
}

export async function publishSuggestion({ guild, fallbackChannel, author, idea }) {
  const targetChannel = await resolveSuggestionChannel(guild, fallbackChannel);

  if (!targetChannel?.isTextBased()) {
    throw new Error('No text channel is available for suggestions.');
  }

  const record = {
    authorId: author.id,
    channelId: targetChannel.id,
    idea,
    status: 'under-review',
    reviewNote: null,
    reviewedBy: null,
    createdAt: new Date().toISOString(),
  };
  const message = await targetChannel.send({ embeds: [makeSuggestionEmbed(author.id, idea, record)] });
  await Promise.allSettled([message.react('👍'), message.react('👎')]);

  updateData((data) => {
    data.suggestions[message.id] = record;
  });

  return message;
}

export async function handleSuggestionCommand(interaction) {
  const idea = interaction.options.getString('idea', true).trim();
  await interaction.deferReply({ ephemeral: true });

  const message = await publishSuggestion({
    guild: interaction.guild,
    fallbackChannel: interaction.channel,
    author: interaction.user,
    idea,
  });

  await interaction.editReply(`Your suggestion was published in ${message.channel}.`);
}

export async function handleSuggestionModal(interaction) {
  const idea = interaction.fields.getTextInputValue('idea-text').trim();
  await interaction.deferReply({ ephemeral: true });

  const message = await publishSuggestion({
    guild: interaction.guild,
    fallbackChannel: interaction.channel,
    author: interaction.user,
    idea,
  });

  await interaction.editReply(`Your suggestion was published in ${message.channel}.`);
}

export async function handleSuggestionStatusCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({ content: 'You need Manage Messages to review suggestions.', ephemeral: true });
    return;
  }

  const messageId = interaction.options.getString('message', true);
  const state = interaction.options.getString('state', true);
  const note = interaction.options.getString('note')?.trim() || null;
  const record = getData().suggestions[messageId];

  if (!record) {
    await interaction.reply({ content: 'That suggestion is not in GuildGuide records.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const channel = await interaction.guild.channels.fetch(record.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    throw new Error('The original suggestion channel is no longer available.');
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    throw new Error('The original suggestion message no longer exists.');
  }

  const updatedRecord = {
    ...record,
    status: state,
    reviewNote: note,
    reviewedBy: interaction.user.id,
    reviewedAt: new Date().toISOString(),
  };
  await message.edit({ embeds: [makeSuggestionEmbed(record.authorId, record.idea, updatedRecord)] });
  updateData((data) => {
    data.suggestions[messageId] = updatedRecord;
  });

  await interaction.editReply(`Suggestion status updated to **${statusConfig[state].label}**.`);
}

export function isSuggestionButton(interaction) {
  return interaction.customId === IDEA_BUTTON_ID;
}

export function isSuggestionModal(interaction) {
  return interaction.customId === IDEA_MODAL_ID;
}
