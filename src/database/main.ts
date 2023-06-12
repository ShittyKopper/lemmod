import fs from "node:fs/promises";
import path from "node:path";
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import config from "../config.js";
import { migrate } from "./migrate.js";

export async function initDB() {
	if (config.debug) {
		sqlite3.verbose();
	}

	const dbFile = path.join(config.dataDir, "data.db");
	await fs.mkdir(config.dataDir, {
		recursive: true,
	});

	const db = await sqlite.open({
		// eslint-disable-next-line @typescript-eslint/unbound-method
		driver: sqlite3.cached.Database,
		filename: dbFile,
	});

	// https://phiresky.github.io/blog/2020/sqlite-performance-tuning/
	console.info("Configuring the database...");
	await db.exec(`
		PRAGMA journal_mode = wal;	
		PRAGMA synchronous = normal;
		PRAGMA auto_vacuum = incremental;
		PRAGMA temp_store = memory;
		PRAGMA mmap_size = 30000000000;
		PRAGMA page_size = 32768;
	`);

	console.info("Migrating the database...");
	await migrate(db);

	console.info("Optimizing the database...");
	await db.exec(`
		PRAGMA vacuum;
		PRAGMA optimize;
	`);

	return db;
}
