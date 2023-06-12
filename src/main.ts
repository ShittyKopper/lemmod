import "dotenv/config";
import { LemmyHttp } from "lemmy-js-client";
import { Bot } from "./bot.js";
import config from "./config.js";
import { initDB } from "./database/main.js";

async function main() {
	const db = await initDB();

	const client = new LemmyHttp(config.user.instance, {
		"user-agent": "lemmod",
	});

	console.info(`Logging in as ${config.user.username} to ${config.user.instance}...`);
	const resp = await client.login({
		username_or_email: config.user.username,
		password: config.user.password,
	});

	if (!resp.jwt) {
		throw ["No JWT returned. This instance might need email verification OR it might be invite only", resp];
	}

	const bot = new Bot(client, db, resp.jwt);
	console.info("Logged in!");
	await bot.start();
}

void main();
