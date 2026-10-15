import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Publish the GuildGuide support and feedback panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('ticketstats')
    .setDescription('View current ticket workload and response age.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Send an idea to the community suggestion board.')
    .addStringOption((option) =>
      option
        .setName('idea')
        .setDescription('Explain your suggestion clearly.')
        .setMinLength(8)
        .setMaxLength(1000)
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Review submitted community suggestions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Set a visible review status on a suggestion.')
        .addStringOption((option) => option.setName('message').setDescription('Suggestion message ID.').setMinLength(17).setMaxLength(20).setRequired(true))
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('The review decision.')
            .addChoices(
              { name: 'Under review', value: 'under-review' },
              { name: 'Planned', value: 'planned' },
              { name: 'Implemented', value: 'implemented' },
              { name: 'Declined', value: 'declined' },
            )
            .setRequired(true),
        )
        .addStringOption((option) => option.setName('note').setDescription('Optional short explanation.').setMaxLength(500)),
    ),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Save a moderation warning for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('member').setDescription('Member to warn.').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for this warning.')
        .setMinLength(3)
        .setMaxLength(500)
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View saved moderation warnings for a member.')
    .addUserOption((option) => option.setName('member').setDescription('Member to inspect.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Remove all saved warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('member').setDescription('Member to clear.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('task')
    .setDescription('Manage your personal community tasks.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a task to your personal list.')
        .addStringOption((option) =>
          option.setName('title').setDescription('Short name of the task.').setMinLength(3).setMaxLength(120).setRequired(true),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Show your active and completed tasks.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('done')
        .setDescription('Mark one task as complete.')
        .addStringOption((option) => option.setName('id').setDescription('The task ID from /task list.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Delete one task from your list.')
        .addStringOption((option) => option.setName('id').setDescription('The task ID from /task list.').setRequired(true)),
    ),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a member task-completion profile.')
    .addUserOption((option) => option.setName('member').setDescription('Member to view.')),

  new SlashCommandBuilder().setName('leaderboard').setDescription('Show the task-completion leaderboard.'),
].map((command) => command.toJSON());
