import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { config } from '../config.js';
import { getData, updateData } from '../storage.js';

const OPEN_TICKET_ID = 'guildguide:ticket-open';
const OPEN_TICKET_MODAL_ID = 'guildguide:ticket-open-modal';
const REQUEST_CLOSE_ID = 'guildguide:ticket-close';
const CONFIRM_CLOSE_ID = 'guildguide:ticket-close-confirm';
const CANCEL_CLOSE_ID = 'guildguide:ticket-close-cancel';

function cleanChannelPart(value) {
  const normalised = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalised.slice(0, 35) || 'member';
}

function hasSupportAccess(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    (config.supportRoleId && interaction.member?.roles?.cache?.has(config.supportRoleId))
  );
}

function mayCloseTicket(interaction, ticket) {
  return ticket.ownerId === interaction.user.id || hasSupportAccess(interaction);
}

async function getValidCategory(guild) {
  if (!config.ticketCategoryId) return undefined;
  const category = await guild.channels.fetch(config.ticketCategoryId).catch(() => null);
  return category?.type === ChannelType.GuildCategory ? category.id : undefined;
}

async function resolveLogChannel(guild) {
  if (!config.ticketLogChannelId) return null;
  const channel = await guild.channels.fetch(config.ticketLogChannelId).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

async function makeTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()]
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((message) => {
      const timestamp = new Date(message.createdTimestamp).toISOString();
      const content = message.cleanContent || '[No text content]';
      const attachments = message.attachments.size
        ? `\nAttachments: ${[...message.attachments.values()].map((attachment) => attachment.url).join(', ')}`
        : '';
      return `[${timestamp}] ${message.author.tag} (${message.author.id}):\n${content}${attachments}`;
    });

  return lines.length ? lines.join('\n\n') : 'No messages were available for this ticket transcript.';
}

function closeConfirmationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CONFIRM_CLOSE_ID).setLabel('Yes, close ticket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(CANCEL_CLOSE_ID).setLabel('Keep it open').setStyle(ButtonStyle.Secondary),
  );
}

export function createTicketButton() {
  return new ButtonBuilder()
    .setCustomId(OPEN_TICKET_ID)
    .setLabel('Open support ticket')
    .setEmoji('🎫')
    .setStyle(ButtonStyle.Primary);
}

export function isTicketButton(interaction) {
  return interaction.customId === OPEN_TICKET_ID;
}

export function isTicketOpenModal(interaction) {
  return interaction.customId === OPEN_TICKET_MODAL_ID;
}

export function isCloseTicketButton(interaction) {
  return interaction.customId === REQUEST_CLOSE_ID;
}

export function isConfirmCloseButton(interaction) {
  return interaction.customId === CONFIRM_CLOSE_ID;
}

export function isCancelCloseButton(interaction) {
  return interaction.customId === CANCEL_CLOSE_ID;
}

export async function showTicketModal(interaction) {
  const existingTicket = Object.entries(getData().tickets).find(([, ticket]) => ticket.ownerId === interaction.user.id && ticket.guildId === interaction.guildId);
  if (existingTicket) {
    await interaction.reply({ content: `You already have an open ticket: <#${existingTicket[0]}>`, ephemeral: true });
    return;
  }

  const modal = new ModalBuilder().setCustomId(OPEN_TICKET_MODAL_ID).setTitle('Open a support ticket');
  const subject = new TextInputBuilder()
    .setCustomId('ticket-subject')
    .setLabel('Short subject')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('For example: I cannot access the event channel')
    .setMinLength(3)
    .setMaxLength(80)
    .setRequired(true);
  const details = new TextInputBuilder()
    .setCustomId('ticket-details')
    .setLabel('Describe the issue')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Include enough detail so the team can help without guessing.')
    .setMinLength(10)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(subject), new ActionRowBuilder().addComponents(details));
  await interaction.showModal(modal);
}

export async function openTicketFromModal(interaction) {
  const existingTicket = Object.entries(getData().tickets).find(([, ticket]) => ticket.ownerId === interaction.user.id && ticket.guildId === interaction.guildId);
  if (existingTicket) {
    await interaction.reply({ content: `You already have an open ticket: <#${existingTicket[0]}>`, ephemeral: true });
    return;
  }

  const subject = interaction.fields.getTextInputValue('ticket-subject').trim();
  const details = interaction.fields.getTextInputValue('ticket-details').trim();
  await interaction.deferReply({ ephemeral: true });

  const parent = await getValidCategory(interaction.guild);
  const permissions = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (config.supportRoleId) {
    permissions.push({
      id: config.supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  const ticketChannel = await interaction.guild.channels.create({
    name: `support-${cleanChannelPart(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent,
    topic: `GuildGuide ticket | Owner: ${interaction.user.id} | Subject: ${subject}`,
    permissionOverwrites: permissions,
  });

  updateData((data) => {
    data.tickets[ticketChannel.id] = {
      guildId: interaction.guildId,
      ownerId: interaction.user.id,
      subject,
      openedAt: new Date().toISOString(),
    };
  });

  const closeButton = new ButtonBuilder()
    .setCustomId(REQUEST_CLOSE_ID)
    .setLabel('Close ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  await ticketChannel.send({
    content: `${interaction.user}${config.supportRoleId ? ` <@&${config.supportRoleId}>` : ''}`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(subject)
        .setDescription(details)
        .addFields({ name: 'Opened by', value: `${interaction.user}`, inline: true })
        .setFooter({ text: 'Only the ticket owner and support team can view this channel.' })
        .setTimestamp(),
    ],
    components: [new ActionRowBuilder().addComponents(closeButton)],
  });

  await interaction.editReply(`Your private ticket is ready: ${ticketChannel}`);
}

export async function requestTicketClose(interaction) {
  const ticket = getData().tickets[interaction.channelId];
  if (!ticket) {
    await interaction.reply({ content: 'This is not an active GuildGuide ticket.', ephemeral: true });
    return;
  }

  if (!mayCloseTicket(interaction, ticket)) {
    await interaction.reply({ content: 'Only the ticket owner or support staff can close it.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: 'Close this ticket? A transcript will be sent to the configured private log channel if one is set.',
    components: [closeConfirmationRow()],
    ephemeral: true,
  });
}

export async function cancelTicketClose(interaction) {
  await interaction.update({ content: 'Ticket closure cancelled. The ticket remains open.', components: [] });
}

export async function confirmTicketClose(interaction) {
  const ticket = getData().tickets[interaction.channelId];
  if (!ticket || !mayCloseTicket(interaction, ticket)) {
    await interaction.update({ content: 'This ticket can no longer be closed from this prompt.', components: [] });
    return;
  }

  await interaction.update({ content: 'Preparing the transcript and closing the ticket…', components: [] });
  const transcript = await makeTranscript(interaction.channel);
  const logChannel = await resolveLogChannel(interaction.guild);
  let archived = false;

  if (logChannel) {
    const fileName = `ticket-${interaction.channelId}-transcript.txt`;
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x747f8d)
          .setTitle('Ticket closed')
          .addFields(
            { name: 'Subject', value: ticket.subject || 'No subject provided' },
            { name: 'Owner', value: `<@${ticket.ownerId}>`, inline: true },
            { name: 'Closed by', value: `${interaction.user}`, inline: true },
          )
          .setFooter({ text: `Original channel: ${interaction.channelId}` })
          .setTimestamp(),
      ],
      files: [new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: fileName })],
    });
    archived = true;
  }

  updateData((data) => {
    delete data.tickets[interaction.channelId];
  });

  await interaction.channel.send(`Ticket closed by ${interaction.user}. ${archived ? 'A transcript was archived for staff.' : 'No transcript log channel is configured.'}`);
  setTimeout(() => {
    interaction.channel?.delete('GuildGuide ticket closed').catch(() => null);
  }, 5000);
}

export async function handleTicketStats(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need Manage Server to view ticket workload.', ephemeral: true });
    return;
  }

  const tickets = Object.entries(getData().tickets).filter(([, ticket]) => ticket.guildId === interaction.guildId);
  const now = Date.now();
  const averageMinutes = tickets.length
    ? Math.round(tickets.reduce((total, [, ticket]) => total + (now - new Date(ticket.openedAt).getTime()) / 60000, 0) / tickets.length)
    : 0;
  const oldest = tickets
    .map(([, ticket]) => new Date(ticket.openedAt).getTime())
    .sort((left, right) => left - right)[0];

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('GuildGuide ticket workload')
        .addFields(
          { name: 'Open tickets', value: String(tickets.length), inline: true },
          { name: 'Average open age', value: tickets.length ? `${averageMinutes} min` : '—', inline: true },
          { name: 'Oldest ticket', value: oldest ? `<t:${Math.floor(oldest / 1000)}:R>` : '—', inline: true },
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}
