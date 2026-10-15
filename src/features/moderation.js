import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getData, updateData } from '../storage.js';

function isModerator(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);
}

function warningLine(warning, index) {
  const date = Math.floor(new Date(warning.createdAt).getTime() / 1000);
  return `**${index + 1}.** ${warning.reason}\nBy <@${warning.staffId}> • <t:${date}:R>`;
}

export async function handleWarnCommand(interaction) {
  const member = interaction.options.getUser('member', true);
  const reason = interaction.options.getString('reason', true).trim();

  if (!isModerator(interaction)) {
    await interaction.reply({ content: 'You need the Moderate Members permission to use this command.', ephemeral: true });
    return;
  }

  if (member.bot) {
    await interaction.reply({ content: 'Bots cannot receive warnings.', ephemeral: true });
    return;
  }

  const warning = { reason, staffId: interaction.user.id, createdAt: new Date().toISOString() };
  let warningCount = 0;

  updateData((data) => {
    data.warnings[member.id] ??= [];
    data.warnings[member.id].push(warning);
    warningCount = data.warnings[member.id].length;
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Warning saved')
        .setDescription(`${member} received a saved moderation warning.`)
        .addFields(
          { name: 'Reason', value: reason },
          { name: 'Total warnings', value: String(warningCount), inline: true },
        )
        .setTimestamp(),
    ],
  });
}

export async function handleWarningsCommand(interaction) {
  const member = interaction.options.getUser('member', true);

  if (member.id !== interaction.user.id && !isModerator(interaction)) {
    await interaction.reply({ content: 'You can only view your own warnings.', ephemeral: true });
    return;
  }

  const warnings = getData().warnings[member.id] ?? [];
  const description = warnings.length
    ? warnings.map(warningLine).join('\n\n').slice(0, 3900)
    : 'No saved warnings.';

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`Warnings: ${member.username}`).setDescription(description)],
    ephemeral: true,
  });
}

export async function handleClearWarningsCommand(interaction) {
  const member = interaction.options.getUser('member', true);

  if (!isModerator(interaction)) {
    await interaction.reply({ content: 'You need the Moderate Members permission to use this command.', ephemeral: true });
    return;
  }

  const count = (getData().warnings[member.id] ?? []).length;
  updateData((data) => {
    delete data.warnings[member.id];
  });

  await interaction.reply({
    content: count ? `Cleared ${count} warning(s) for ${member}.` : `${member} had no saved warnings.`,
    ephemeral: true,
  });
}
