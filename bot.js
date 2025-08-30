/* eslint-disable */
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');
const leoProfanity = require('leo-profanity');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN) {
	console.error('Missing DISCORD_TOKEN in environment.');
	process.exit(1);
}
if (!GEMINI_API_KEY) {
	console.error('Missing GEMINI_API_KEY in environment.');
	process.exit(1);
}

const TEXT_MODEL = 'gemini-2.0-flash';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

// --- Discord Client ---
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
	partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User],
});

// --- SQLite database (preserve schema and location) ---
const dbPath = process.env.SQLITE_PATH || path.resolve(process.cwd(), 'guild_settings.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
	db.run(
		`CREATE TABLE IF NOT EXISTS guild_settings (
			guild_id INTEGER PRIMARY KEY,
			welcome_channel_id INTEGER,
			leave_channel_id INTEGER,
			qotd_channel_id INTEGER,
			report_log_channel_id INTEGER,
			moderation_enabled INTEGER DEFAULT 1,
			ai_enabled INTEGER DEFAULT 1
		)`
	);
	db.run(
		`CREATE TABLE IF NOT EXISTS profanity_settings (
			guild_id INTEGER PRIMARY KEY,
			added_words TEXT DEFAULT '[]',
			use_default INTEGER DEFAULT 1
		)`
	);
	db.run(
		`CREATE TABLE IF NOT EXISTS user_xp (
			guild_id INTEGER,
			user_id INTEGER,
			xp INTEGER DEFAULT 0,
			level INTEGER DEFAULT 0,
			PRIMARY KEY (guild_id, user_id)
		)`
	);
});

function getGuildSettings(guildId) {
	return new Promise((resolve, reject) => {
		db.get('SELECT * FROM guild_settings WHERE guild_id=?', [guildId], (err, row) => {
			if (err) return reject(err);
			if (row) {
				return resolve({
					guild_id: row.guild_id,
					welcome_channel_id: row.welcome_channel_id,
					leave_channel_id: row.leave_channel_id,
					qotd_channel_id: row.qotd_channel_id,
					report_log_channel_id: row.report_log_channel_id,
					moderation_enabled: Boolean(row.moderation_enabled),
					ai_enabled: Boolean(row.ai_enabled),
				});
			}
			db.run('INSERT INTO guild_settings (guild_id) VALUES (?)', [guildId], (insErr) => {
				if (insErr) return reject(insErr);
				db.get('SELECT * FROM guild_settings WHERE guild_id=?', [guildId], (err2, row2) => {
					if (err2) return reject(err2);
					return resolve({
						guild_id: row2.guild_id,
						welcome_channel_id: row2.welcome_channel_id,
						leave_channel_id: row2.leave_channel_id,
						qotd_channel_id: row2.qotd_channel_id,
						report_log_channel_id: row2.report_log_channel_id,
						moderation_enabled: Boolean(row2.moderation_enabled),
						ai_enabled: Boolean(row2.ai_enabled),
					});
				});
			});
		});
	});
}

function updateGuildSetting(guildId, column, value) {
	return new Promise((resolve, reject) => {
		db.run(`UPDATE guild_settings SET ${column}=? WHERE guild_id=?`, [value, guildId], function (err) {
			if (err) return reject(err);
			return resolve();
		});
	});
}

// --- Profanity Management (DB-based) ---
function getProfanitySettings(guildId) {
	return new Promise((resolve, reject) => {
		db.get('SELECT * FROM profanity_settings WHERE guild_id=?', [guildId], (err, row) => {
			if (err) return reject(err);
			if (row) {
				return resolve({
					guild_id: row.guild_id,
					added_words: JSON.parse(row.added_words || '[]'),
					use_default: Boolean(row.use_default),
				});
			}
			db.run('INSERT INTO profanity_settings (guild_id) VALUES (?)', [guildId], (insErr) => {
				if (insErr) return reject(insErr);
				db.get('SELECT * FROM profanity_settings WHERE guild_id=?', [guildId], (err2, row2) => {
					if (err2) return reject(err2);
					return resolve({
						guild_id: row2.guild_id,
						added_words: JSON.parse(row2.added_words || '[]'),
						use_default: Boolean(row2.use_default),
					});
				});
			});
		});
	});
}

function updateProfanitySettings(guildId, addedWords, useDefault) {
	return new Promise((resolve, reject) => {
		db.run('INSERT OR REPLACE INTO profanity_settings (guild_id, added_words, use_default) VALUES (?, ?, ?)', 
			[guildId, JSON.stringify(addedWords), useDefault ? 1 : 0], function (err) {
			if (err) return reject(err);
			return resolve();
		});
	});
}

// --- XP System ---
function getUserXP(guildId, userId) {
	return new Promise((resolve, reject) => {
		db.get('SELECT * FROM user_xp WHERE guild_id=? AND user_id=?', [guildId, userId], (err, row) => {
			if (err) return reject(err);
			if (row) {
				return resolve({
					guild_id: row.guild_id,
					user_id: row.user_id,
					xp: row.xp,
					level: row.level,
				});
			}
			db.run('INSERT INTO user_xp (guild_id, user_id) VALUES (?, ?)', [guildId, userId], (insErr) => {
				if (insErr) return reject(insErr);
				db.get('SELECT * FROM user_xp WHERE guild_id=? AND user_id=?', [guildId, userId], (err2, row2) => {
					if (err2) return reject(err2);
					return resolve({
						guild_id: row2.guild_id,
						user_id: row2.user_id,
						xp: row2.xp,
						level: row2.level,
					});
				});
			});
		});
	});
}

function addUserXP(guildId, userId, xpToAdd) {
	return new Promise((resolve, reject) => {
		db.run('INSERT OR REPLACE INTO user_xp (guild_id, user_id, xp, level) VALUES (?, ?, COALESCE((SELECT xp FROM user_xp WHERE guild_id=? AND user_id=?) + ?, ?), ?)', 
			[guildId, userId, guildId, userId, xpToAdd, xpToAdd], function (err) {
			if (err) return reject(err);
			return resolve();
		});
	});
}

function getLeaderboard(guildId, limit = 10) {
	return new Promise((resolve, reject) => {
		db.all('SELECT * FROM user_xp WHERE guild_id=? ORDER BY xp DESC LIMIT ?', [guildId, limit], (err, rows) => {
			if (err) return reject(err);
			return resolve(rows || []);
		});
	});
}

function calculateLevel(xp) {
	return Math.floor(0.1 * Math.sqrt(xp));
}

function calculateXPForLevel(level) {
	return Math.pow(level / 0.1, 2);
}

// --- Profanity Management (DB-based) ---
leoProfanity.loadDictionary();

async function buildGuildProfanityFilter(guildId) {
	const settings = await getProfanitySettings(guildId);
	const customList = new Set(leoProfanity.list());
	for (const w of settings.added_words) customList.add(w.toLowerCase());
	const words = Array.from(customList);
	return {
		check: (text) => {
			if (!text) return false;
			if (!settings.use_default && words.length === 0) return false;
			return leoProfanity.check(text, words);
		},
		list: () => words,
	};
}

// --- Slash Commands ---
const slashCommands = [
	{
		name: 'setup_welcome',
		description: 'Set welcome channel',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'channel', description: 'Welcome channel', type: 7, required: false, channel_types: [ChannelType.GuildText] },
		],
	},
	{
		name: 'setup_leave',
		description: 'Set leave channel',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'channel', description: 'Leave channel', type: 7, required: false, channel_types: [ChannelType.GuildText] },
		],
	},
	{
		name: 'setup_qotd',
		description: 'Set QOTD channel',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'channel', description: 'QOTD channel', type: 7, required: false, channel_types: [ChannelType.GuildText] },
		],
	},
	{
		name: 'setup_reportlog',
		description: 'Set report log channel',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'channel', description: 'Report log channel', type: 7, required: false, channel_types: [ChannelType.GuildText] },
		],
	},
	{
		name: 'setup_moderation',
		description: 'Enable or disable moderation',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'enabled', description: 'true to enable, false to disable', type: 5, required: true },
		],
	},
	{
		name: 'setup_ai',
		description: 'Enable or disable AI mention replies',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'enabled', description: 'true to enable, false to disable', type: 5, required: true },
		],
	},
	{
		name: 'forceqotd',
		description: "Send today's Question of the Day manually",
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
	},
	{
		name: 'profanity_mode',
		description: 'Set profanity mode to default or custom (per-guild)',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'use_default', description: 'true = default list, false = custom', type: 5, required: true },
		],
	},
	{
		name: 'profanity_add',
		description: 'Add a word to this guild\'s profanity list',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'word', description: 'Word to add', type: 3, required: true },
		],
	},
	{
		name: 'profanity_remove',
		description: 'Remove a word from this guild\'s profanity list',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
		options: [
			{ name: 'word', description: 'Word to remove', type: 3, required: true },
		],
	},
	{
		name: 'profanity_list',
		description: 'Show this guild\'s custom profanity words',
		dm_permission: false,
		default_member_permissions: String(PermissionsBitField.Flags.Administrator),
	},
	{
		name: 'leaderboard',
		description: 'Show server XP leaderboard',
		dm_permission: false,
		options: [
			{ name: 'limit', description: 'Number of users to show (max 25)', type: 4, required: false, min_value: 1, max_value: 25 },
		],
	},
];

// Register slash commands at startup
async function registerSlashCommands() {
	if (!client.application) return;
	const devGuildIds = (process.env.DEV_GUILD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
	if (devGuildIds.length > 0) {
		for (const gid of devGuildIds) {
			const guild = client.guilds.cache.get(gid);
			if (guild) {
				await guild.commands.set(slashCommands).catch(() => undefined);
			}
		}
		return; // per‑guild deploy is instant
	}
	// Global deploy (can take up to ~1 hour to fully propagate)
	await client.application.commands.set(slashCommands);
}

// --- Status Update Task ---
async function updateStatus() {
	const serverCount = client.guilds.cache.size;
	await client.user.setPresence({
		activities: [{ type: ActivityType.Watching, name: `${serverCount} servers` }],
		status: 'online',
	});
}

// --- QOTD Generation ---
async function generateQOTD() {
	const prompt = 'Give a unique, thought-provoking question of the day for a Discord community.';
	const result = await model.generateContent([prompt]);
	const text = result?.response?.text?.() || '';
	return String(text).slice(0, 4000);
}

// --- AI Mention Reply ---
async function generateAIReply(systemRules, userQuery) {
	const result = await model.generateContent([systemRules, userQuery]);
	const text = result?.response?.text?.() || '';
	return String(text).slice(0, 4000);
}

// --- Events ---
client.once('ready', async () => {
	console.log(`Logged in as ${client.user.tag}`);
	console.log(`Bot is in ${client.guilds.cache.size} servers`);
	await registerSlashCommands();
	await updateStatus();
	setInterval(() => {
		updateStatus().catch(() => undefined);
	}, 5 * 60 * 1000);

	// Daily QOTD at 00:00 (server time)
	cron.schedule('0 0 * * *', async () => {
		for (const guild of client.guilds.cache.values()) {
			try {
				const settings = await getGuildSettings(guild.id);
				if (settings.qotd_channel_id) {
					const q = await generateQOTD();
					const channel = client.channels.cache.get(String(settings.qotd_channel_id));
					if (channel && channel.type === ChannelType.GuildText) {
						await channel.send(`**Question of the Day:**\n> ${q}`);
					}
				}
			} catch (_) {}
		}
	});
});

client.on('guildCreate', async () => {
	await updateStatus();
});
client.on('guildDelete', async () => {
	await updateStatus();
});

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const { commandName } = interaction;

	try {
		if (commandName === 'setup_welcome') {
			const channel = interaction.options.getChannel('channel');
			await updateGuildSetting(interaction.guildId, 'welcome_channel_id', channel ? channel.id : null);
			await interaction.reply({ content: `✅ Welcome channel set to ${channel ? channel.toString() : 'disabled'}`, ephemeral: true });
			return;
		}
		if (commandName === 'setup_leave') {
			const channel = interaction.options.getChannel('channel');
			await updateGuildSetting(interaction.guildId, 'leave_channel_id', channel ? channel.id : null);
			await interaction.reply({ content: `✅ Leave channel set to ${channel ? channel.toString() : 'disabled'}`, ephemeral: true });
			return;
		}
		if (commandName === 'setup_qotd') {
			const channel = interaction.options.getChannel('channel');
			await updateGuildSetting(interaction.guildId, 'qotd_channel_id', channel ? channel.id : null);
			await interaction.reply({ content: `✅ QOTD channel set to ${channel ? channel.toString() : 'disabled'}`, ephemeral: true });
			return;
		}
		if (commandName === 'setup_reportlog') {
			const channel = interaction.options.getChannel('channel');
			await updateGuildSetting(interaction.guildId, 'report_log_channel_id', channel ? channel.id : null);
			await interaction.reply({ content: `✅ Report log channel set to ${channel ? channel.toString() : 'disabled'}`, ephemeral: true });
			return;
		}
		if (commandName === 'setup_moderation') {
			const enabled = interaction.options.getBoolean('enabled', true);
			await updateGuildSetting(interaction.guildId, 'moderation_enabled', enabled ? 1 : 0);
			await interaction.reply({ content: `✅ Moderation ${enabled ? 'enabled' : 'disabled'}`, ephemeral: true });
			return;
		}
		if (commandName === 'setup_ai') {
			const enabled = interaction.options.getBoolean('enabled', true);
			await updateGuildSetting(interaction.guildId, 'ai_enabled', enabled ? 1 : 0);
			await interaction.reply({ content: `✅ AI mention replies ${enabled ? 'enabled' : 'disabled'}`, ephemeral: true });
			return;
		}
		if (commandName === 'forceqotd') {
			const settings = await getGuildSettings(interaction.guildId);
			if (!settings.qotd_channel_id) {
				await interaction.reply({ content: '⚠ No QOTD channel set for this server.', ephemeral: true });
				return;
			}
			const q = await generateQOTD();
			const channel = client.channels.cache.get(String(settings.qotd_channel_id));
			if (channel && channel.type === ChannelType.GuildText) {
				await channel.send(`**Question of the Day:**\n> ${q}`);
				await interaction.reply({ content: '✅ QOTD sent.', ephemeral: true });
			} else {
				await interaction.reply({ content: '⚠ Could not find the QOTD channel.', ephemeral: true });
			}
			return;
		}

		// Profanity commands
		if (commandName === 'profanity_mode') {
			const useDefault = interaction.options.getBoolean('use_default', true);
			const settings = await getProfanitySettings(interaction.guildId);
			await updateProfanitySettings(interaction.guildId, settings.added_words, useDefault);
			await interaction.reply({ content: `✅ Profanity mode set to ${useDefault ? 'default' : 'custom'} for this guild.`, ephemeral: true });
			return;
		}
		if (commandName === 'profanity_add') {
			const word = String(interaction.options.getString('word', true)).toLowerCase();
			const settings = await getProfanitySettings(interaction.guildId);
			if (!settings.added_words.includes(word)) {
				settings.added_words.push(word);
				await updateProfanitySettings(interaction.guildId, settings.added_words, settings.use_default);
			}
			await interaction.reply({ content: `✅ Added to custom list: ${word}`, ephemeral: true });
			return;
		}
		if (commandName === 'profanity_remove') {
			const word = String(interaction.options.getString('word', true)).toLowerCase();
			const settings = await getProfanitySettings(interaction.guildId);
			settings.added_words = settings.added_words.filter((w) => w !== word);
			await updateProfanitySettings(interaction.guildId, settings.added_words, settings.use_default);
			await interaction.reply({ content: `✅ Removed from custom list: ${word}`, ephemeral: true });
			return;
		}
		if (commandName === 'profanity_list') {
			const settings = await getProfanitySettings(interaction.guildId);
			const desc = `Mode: ${settings.use_default ? 'default' : 'custom'}\nAdded: ${settings.added_words.join(', ') || '[none]'}`;
			await interaction.reply({ content: desc, ephemeral: true });
			return;
		}
		if (commandName === 'leaderboard') {
			const limit = interaction.options.getInteger('limit') || 10;
			const leaderboard = await getLeaderboard(interaction.guildId, limit);
			if (leaderboard.length === 0) {
				await interaction.reply({ content: 'No XP data found for this server.', ephemeral: true });
				return;
			}
			let desc = '**Server XP Leaderboard**\n';
			for (let i = 0; i < leaderboard.length; i++) {
				const user = leaderboard[i];
				const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);
				const username = member ? member.displayName : `User ${user.user_id}`;
				desc += `${i + 1}. ${username} - Level ${user.level} (${user.xp} XP)\n`;
			}
			await interaction.reply({ content: desc, ephemeral: false });
			return;
		}
	} catch (err) {
		console.error('Interaction error:', err);
		if (interaction.deferred || interaction.replied) {
			await interaction.followUp({ content: 'An error occurred handling this command.', ephemeral: true }).catch(() => undefined);
		} else {
			await interaction.reply({ content: 'An error occurred handling this command.', ephemeral: true }).catch(() => undefined);
		}
	}
});

client.on('messageCreate', async (message) => {
	try {
		if (!message.guild || message.author.bot) return;
		const settings = await getGuildSettings(message.guild.id);

		// XP System - Add 1 XP per message
		try {
			const userXP = await getUserXP(message.guild.id, message.author.id);
			const oldLevel = userXP.level;
			const newXP = userXP.xp + 1;
			const newLevel = calculateLevel(newXP);
			
			await addUserXP(message.guild.id, message.author.id, 1);
			
			// Level up notification
			if (newLevel > oldLevel) {
				await message.channel.send(`🎉 ${message.author.toString()} Reached Level ${newLevel}!`);
			}
		} catch (e) {
			console.error('XP error:', e);
		}

		// Automod profanity
		if (settings.moderation_enabled) {
			const filter = await buildGuildProfanityFilter(message.guild.id);
			if (filter.check(message.content || '')) {
				await message.delete().catch(() => undefined);
				const warnMsg = await message.channel.send({ content: `${message.author.toString()} 🚫 Inappropriate language detected.` }).catch(() => undefined);
				if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => undefined), 5000);
				if (settings.report_log_channel_id) {
					const logChannel = client.channels.cache.get(String(settings.report_log_channel_id));
					if (logChannel && logChannel.type === ChannelType.GuildText) {
						const embed = new EmbedBuilder()
							.setTitle('Automod Alert')
							.setColor(0xffa500)
							.addFields(
								{ name: 'User', value: message.author.toString(), inline: false },
								{ name: 'Content', value: message.content || '[No content]', inline: false },
							);
						await logChannel.send({ embeds: [embed] }).catch(() => undefined);
					}
				}
				return; // stop further processing
			}
		}

		// AI mention
		if (settings.ai_enabled && message.mentions.users.has(client.user.id)) {
			const raw = message.content || '';
			const cleaned = raw
				.replace(`<@${client.user.id}>`, '')
				.replace(`<@!${client.user.id}>`, '')
				.trim();
			if (!cleaned) {
				await message.reply({ content: "You mentioned me, but didn't ask anything." });
				return;
			}
			const systemRules = 'You are a helpful and respectful AI assistant. Never use profanity, sexual content, or slurs. Keep replies polite, concise, and under 4000 characters.';
			try {
				const reply = await generateAIReply(systemRules, cleaned);
				const filter = await buildGuildProfanityFilter(message.guild.id);
				if (filter.check(reply)) {
					await message.reply({ content: 'Apparently, our AI tried to curse — this is strictly blocked by the developer team of InfiniteBot.\n\nThink this is wrong? Open an issue on https://github.com/OptimiDEV/InfiniteBot/issues' });
				} else {
					await message.reply({ content: reply });
				}
			} catch (e) {
				await message.reply({ content: `Error generating response: \`GENRESPONSE-EFILL-${e}\`` });
			}
		}
	} catch (e) {
		console.error('messageCreate error:', e);
	}
});

process.on('SIGINT', () => {
	try { db.close(); } catch (_) {}
	process.exit(0);
});

client.login(DISCORD_TOKEN);
