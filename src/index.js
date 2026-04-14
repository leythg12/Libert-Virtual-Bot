require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const cron   = require('node-cron');
const phpvms = require('./phpvms');
const embeds = require('./embeds');
const otp    = require('./otp');
const mailer = require('./mailer');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let lastPirepId = null;
let lastNewsId  = null;

// ── Mask email for display ─────────────────────────────────────────────────
function maskEmail(email) {
  const [user, domain] = email.split('@');
  const masked = user.slice(0,2) + '***' + user.slice(-1);
  return `${masked}@${domain}`;
}

// ── Assign roles from pilot data ───────────────────────────────────────────
async function assignRoles(member, pilot) {
  const allRanks = [
    process.env.ROLE_STUDENT, process.env.ROLE_SECOND_OFFICER,
    process.env.ROLE_FIRST_OFFICER, process.env.ROLE_SENIOR_FO,
    process.env.ROLE_CAPTAIN, process.env.ROLE_SENIOR_CAPTAIN,
    process.env.ROLE_CHIEF_PILOT,
  ].filter(Boolean);

  const allHubs = [
    process.env.ROLE_HUB_LFBD,
    process.env.ROLE_HUB_LFPG,
  ].filter(Boolean);

  const remove = [...allRanks, ...allHubs, process.env.ROLE_UNVERIFIED].filter(Boolean);
  const add    = [];

  const rankRole = phpvms.rankToRoleId(pilot.rank?.name);
  if (rankRole) add.push(rankRole);

  const hubRole = phpvms.hubToRoleId(pilot.home_airport_id);
  if (hubRole) add.push(hubRole);

  if (process.env.ROLE_PILOT) add.push(process.env.ROLE_PILOT);

  await member.roles.remove(remove.filter(r => member.roles.cache.has(r))).catch(()=>{});
  await member.roles.add(add.filter(r => !member.roles.cache.has(r))).catch(()=>{});
  await member.setNickname(`${pilot.name} | ${pilot.pilot_id}`).catch(()=>{});
}

// ── Log helper ─────────────────────────────────────────────────────────────
async function log(guild, msg) {
  if (!process.env.LOG_CHANNEL_ID) return;
  const ch = guild?.channels?.cache?.get(process.env.LOG_CHANNEL_ID);
  ch?.send(`\`${new Date().toISOString()}\` ${msg}`).catch(()=>{});
}

// ── Verify buttons row ─────────────────────────────────────────────────────
function verifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_step1')
      .setLabel('Vérifier mon compte')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✈')
  );
}

function enterCodeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_step2')
      .setLabel('Entrer le code')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔑')
  );
}

// ── Ready ──────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log(`[LBA BOT] Online as ${client.user.tag}`);
  client.user.setActivity('Liberté Air Virtual · LBA', { type: 3 });

  await mailer.verify().catch(e => console.error('[MAILER] SMTP error:', e.message));

  const pireps = await phpvms.getLatestPireps(1);
  if (pireps[0]) lastPirepId = pireps[0].id;
  const news = await phpvms.getLatestNews(1);
  if (news[0]) lastNewsId = news[0].id;

  console.log('[LBA BOT] Ready. Last PIREP:', lastPirepId, '| Last News:', lastNewsId);
});

// ── New member ─────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (process.env.ROLE_UNVERIFIED)
    await member.roles.add(process.env.ROLE_UNVERIFIED).catch(()=>{});

  const ch = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
  ch?.send({ embeds: [embeds.welcome(member)] });

  await log(member.guild, `👋 Nouveau membre : **${member.user.tag}** (${member.id})`);
});

// ── Interactions ───────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {

  // ── BUTTON: Step 1 — ask for Pilot ID ─────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'verify_step1') {
    const modal = new ModalBuilder()
      .setCustomId('modal_pilotid')
      .setTitle('Vérification — Étape 1/2');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('pilot_id')
        .setLabel('Votre Pilot ID (ex: LBA0001)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('LBA0001')
        .setRequired(true).setMinLength(3).setMaxLength(12)
    ));
    return interaction.showModal(modal);
  }

  // ── BUTTON: Step 2 — ask for OTP code ─────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'verify_step2') {
    if (!otp.hasPending(interaction.user.id)) {
      return interaction.reply({
        embeds: [embeds.error('Aucun code en attente. Veuillez recommencer la vérification.')],
        ephemeral: true,
      });
    }
    const modal = new ModalBuilder()
      .setCustomId('modal_otp')
      .setTitle('Vérification — Étape 2/2');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('otp_code')
        .setLabel('Code reçu par email (6 chiffres)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('123456')
        .setRequired(true).setMinLength(6).setMaxLength(6)
    ));
    return interaction.showModal(modal);
  }

  // ── MODAL: Pilot ID submitted ──────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_pilotid') {
    await interaction.deferReply({ ephemeral: true });

    const rawId = interaction.fields.getTextInputValue('pilot_id').trim().toUpperCase();
    const pilot = await phpvms.getPilotByPilotId(rawId);

    if (!pilot || !pilot.email) {
      return interaction.editReply({ embeds: [embeds.verifyFailPilotId(rawId)] });
    }

    // Generate and store OTP
    const code = otp.generate();
    otp.set(interaction.user.id, code, rawId, pilot);

    // Send email
    try {
      await mailer.sendOTP(pilot.email, pilot.name, code);
    } catch (e) {
      console.error('[MAILER] Send error:', e.message);
      otp.clear(interaction.user.id);
      return interaction.editReply({
        embeds: [embeds.error('Erreur lors de l\'envoi de l\'email. Contactez le staff.')],
      });
    }

    const expiry = process.env.OTP_EXPIRY_MINUTES || 10;
    await interaction.editReply({
      embeds: [embeds.otpSent(maskEmail(pilot.email), expiry)],
      components: [enterCodeRow()],
    });

    await log(interaction.guild, `📧 OTP envoyé : **${interaction.user.tag}** → ${pilot.name} (${rawId}) → ${maskEmail(pilot.email)}`);
  }

  // ── MODAL: OTP code submitted ──────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_otp') {
    await interaction.deferReply({ ephemeral: true });

    const inputCode = interaction.fields.getTextInputValue('otp_code').trim();
    const result    = otp.verify(interaction.user.id, inputCode);

    if (!result.valid) {
      const embed = result.reason === 'expired' ? embeds.otpExpired()
                  : result.reason === 'no_pending' ? embeds.error('Aucun code en attente. Recommencez.')
                  : embeds.otpWrong();
      return interaction.editReply({ embeds: [embed] });
    }

    // Assign roles
    await assignRoles(interaction.member, result.pilotData);
    await interaction.editReply({ embeds: [embeds.verifySuccess(result.pilotData)] });
    await log(interaction.guild,
      `✅ Vérifié : **${interaction.user.tag}** → ${result.pilotData.name} (${result.pilotId}) · ${result.pilotData.rank?.name||'?'} · Hub ${result.pilotData.home_airport_id}`
    );
  }

  // ── SLASH COMMANDS ─────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'stats') {
    await interaction.deferReply();
    const data = await phpvms.getStats();
    await interaction.editReply({ embeds: [embeds.stats(data)] });
  }

  if (interaction.commandName === 'pireps') {
    await interaction.deferReply();
    const count  = interaction.options.getInteger('count') || 5;
    const pireps = await phpvms.getLatestPireps(count);
    if (!pireps.length) return interaction.editReply('Aucun PIREP trouvé.');
    await interaction.editReply({ embeds: pireps.slice(0,5).map(embeds.pirep) });
  }

  if (interaction.commandName === 'pilot') {
    await interaction.deferReply();
    const rawId = interaction.options.getString('pilot_id').trim().toUpperCase();
    const pilot = await phpvms.getPilotByPilotId(rawId);
    if (!pilot) return interaction.editReply({ embeds: [embeds.verifyFailPilotId(rawId)] });
    await interaction.editReply({ embeds: [embeds.pilot(pilot)] });
  }

  if (interaction.commandName === 'setup-verify') {
    await interaction.channel.send({ embeds: [embeds.verifyPanel()], components: [verifyRow()] });
    await interaction.reply({ content: '✅ Panel posté.', ephemeral: true });
  }

  if (interaction.commandName === 'sync') {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user');
    const rawId  = interaction.options.getString('pilot_id').trim().toUpperCase();
    const pilot  = await phpvms.getPilotByPilotId(rawId);
    if (!pilot) return interaction.editReply({ embeds: [embeds.verifyFailPilotId(rawId)] });
    await assignRoles(target, pilot);
    await interaction.editReply({ content: `✅ Rôles synchronisés pour **${target.user.tag}** → ${pilot.name}` });
    await log(interaction.guild, `🔄 Sync par ${interaction.user.tag} : **${target.user.tag}** → ${rawId}`);
  }
});

// ── PIREP polling ──────────────────────────────────────────────────────────
cron.schedule(`*/${process.env.PIREP_POLL_INTERVAL||5} * * * *`, async () => {
  const guild = client.guilds.cache.first();
  const ch    = guild?.channels?.cache?.get(process.env.PIREP_CHANNEL_ID);
  if (!ch) return;

  const pireps = await phpvms.getLatestPireps(5);
  if (!pireps.length) return;

  if (lastPirepId === null) { lastPirepId = pireps[0].id; return; }

  const fresh = pireps.filter(p => p.id > lastPirepId);
  if (fresh.length) {
    lastPirepId = pireps[0].id;
    for (const p of fresh.reverse())
      await ch.send({ embeds: [embeds.pirep(p)] }).catch(()=>{});
  }
});

// ── News polling ───────────────────────────────────────────────────────────
cron.schedule('*/30 * * * *', async () => {
  const guild = client.guilds.cache.first();
  const ch    = guild?.channels?.cache?.get(process.env.NEWS_CHANNEL_ID);
  if (!ch) return;

  const news = await phpvms.getLatestNews(3);
  if (!news.length) return;

  if (lastNewsId === null) { lastNewsId = news[0].id; return; }

  const fresh = news.filter(n => n.id > lastNewsId);
  if (fresh.length) {
    lastNewsId = news[0].id;
    for (const n of fresh.reverse())
      await ch.send({ embeds: [embeds.news(n)] }).catch(()=>{});
  }
});

client.login(process.env.DISCORD_TOKEN);
