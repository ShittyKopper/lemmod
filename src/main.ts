import "dotenv/config";
import { LemmyHttp } from "lemmy-js-client";
import { Bot } from "./bot.js";
import config from "./config.js";
import { initDB } from "./database/main.js";

function monkeyPatchConsoleLog() {
	const realLog = console.log;
	console.log = function (...msg) {
		realLog(" ", ...msg);
	};

	const realDebug = console.debug;
	console.debug = function (...msg) {
		if (config.debug) realDebug("D", ...msg);
	};

	const realInfo = console.info;
	console.info = function (...msg) {
		realInfo("I", ...msg);
	};

	const realWarn = console.warn;
	console.warn = function (...msg) {
		realWarn("W", ...msg);
	};

	const realError = console.error;
	console.error = function (...msg) {
		realError("E", ...msg);
	};
}

async function main() {
	monkeyPatchConsoleLog();

	const db = await initDB();

	const client = new LemmyHttp(config.user.instance, {
		"user-agent": "lemmod/0.1.0 (by @ShittyKopper@lemmy.blahaj.zone)",
	});

	console.info(
		"main",
		"Logging in as",
		config.user.username,
		"to",
		config.user.instance
	);
	const resp = await client.login({
		username_or_email: config.user.username,
		password: config.user.password,
	});

	if (!resp.jwt) {
		throw [
			"No JWT returned. This instance might need email verification OR it might be invite only",
			resp,
		];
	}

	const bot = new Bot(client, db, resp.jwt);
	console.info("main", "Logged in!");
	await bot.start();
}

void main();
