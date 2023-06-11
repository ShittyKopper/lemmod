import "dotenv/config";
import { LemmyHttp } from "lemmy-js-client";
import config from "./config.js";
import Bot from "./bot.js";

async function main() {
	const client = new LemmyHttp(config.user.instance, {
		"user-agent": "lemmod",
	});

	console.info(`Logging in as ${config.user.username} to ${config.user.instance}`);
	const resp = await client.login({
		username_or_email: config.user.username,
		password: config.user.password,
	});

	if (!resp.jwt) {
		console.error("No JWT returned. This instance might need email verification OR it might be invite only", resp);
		return;
	}

	const bot = new Bot(client, resp.jwt);
	console.info("Logged in!");
}

main().catch(e => {
	console.error(e);
});
