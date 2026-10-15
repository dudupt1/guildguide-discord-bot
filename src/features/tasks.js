import { EmbedBuilder } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { getData, updateData } from '../storage.js';

function getUserTasks(data, userId) {
  return data.tasks[userId] ?? [];
}

function shortId() {
  return randomUUID().split('-')[0];
}

function taskLine(task) {
  const state = task.completed ? '✅' : '⬜';
  return `${state} \`${task.id}\` — ${task.title}`;
}

export async function handleTaskCommand(interaction) {
  const action = interaction.options.getSubcommand();

  if (action === 'add') {
    const title = interaction.options.getString('title', true).trim();
    const task = { id: shortId(), title, completed: false, createdAt: new Date().toISOString() };

    updateData((data) => {
      data.tasks[interaction.user.id] ??= [];
      data.tasks[interaction.user.id].push(task);
    });

    await interaction.reply({ content: `Task added: \`${task.id}\` — **${task.title}**`, ephemeral: true });
    return;
  }

  if (action === 'list') {
    const tasks = getUserTasks(getData(), interaction.user.id);

    if (tasks.length === 0) {
      await interaction.reply({ content: 'Your task list is empty. Add one with `/task add`.', ephemeral: true });
      return;
    }

    const active = tasks.filter((task) => !task.completed);
    const complete = tasks.filter((task) => task.completed);
    const description = [
      active.length ? `**Active**\n${active.map(taskLine).join('\n')}` : '',
      complete.length ? `**Completed**\n${complete.map(taskLine).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`${interaction.user.username}'s tasks`).setDescription(description)],
      ephemeral: true,
    });
    return;
  }

  const taskId = interaction.options.getString('id', true).trim().toLowerCase();
  let changedTask;

  updateData((data) => {
    const tasks = getUserTasks(data, interaction.user.id);
    const index = tasks.findIndex((task) => task.id === taskId);

    if (index === -1) {
      return;
    }

    if (action === 'done') {
      tasks[index].completed = true;
      tasks[index].completedAt = new Date().toISOString();
      changedTask = tasks[index];
    }

    if (action === 'remove') {
      changedTask = tasks[index];
      tasks.splice(index, 1);
    }
  });

  if (!changedTask) {
    await interaction.reply({ content: 'I could not find that task ID. Run `/task list` and try again.', ephemeral: true });
    return;
  }

  const verb = action === 'done' ? 'completed' : 'removed';
  await interaction.reply({ content: `Task ${verb}: **${changedTask.title}**`, ephemeral: true });
}

export async function handleProfileCommand(interaction) {
  const member = interaction.options.getUser('member') ?? interaction.user;
  const tasks = getUserTasks(getData(), member.id);
  const completed = tasks.filter((task) => task.completed).length;
  const active = tasks.length - completed;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setAuthor({ name: `${member.username}'s GuildGuide profile`, iconURL: member.displayAvatarURL() })
        .addFields(
          { name: 'Completed tasks', value: String(completed), inline: true },
          { name: 'Active tasks', value: String(active), inline: true },
          { name: 'Completion rate', value: `${rate}%`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}

export async function handleLeaderboardCommand(interaction) {
  const entries = Object.entries(getData().tasks)
    .map(([userId, tasks]) => ({
      userId,
      completed: tasks.filter((task) => task.completed).length,
      total: tasks.length,
    }))
    .filter((entry) => entry.completed > 0)
    .sort((left, right) => right.completed - left.completed || right.total - left.total)
    .slice(0, 10);

  const description = entries.length
    ? entries.map((entry, index) => `**${index + 1}.** <@${entry.userId}> — ${entry.completed} completed`).join('\n')
    : 'No completed tasks yet. Be the first with `/task done`!';

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xeb459e).setTitle('Task completion leaderboard').setDescription(description)],
  });
}
