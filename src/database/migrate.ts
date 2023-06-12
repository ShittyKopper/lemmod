import * as sqlite from "sqlite";

const migrations = [import("./migrations/00.js")];

export async function migrate(db: sqlite.Database) {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const ver = (await db.get<{ user_version: number }>("PRAGMA user_version;")!).user_version;

	if (ver == migrations.length) {
		console.info("migrate", "No need. Database is up to date.");
		return;
	}

	console.info("migrate", "Will run", migrations.length - ver, "migrations.");

	await db.exec("BEGIN;");
	for (const [i, migration] of migrations.slice(ver).entries()) {
		const migrateFn = (await migration).default;

		try {
			await migrateFn(db);
			console.info("migrate", "Migration", ver + i, "successful.");
		} catch (e) {
			console.error("migrate", "Migration", ver + i, "failed. Attempting rollback.", e);
			await db.exec("ROLLBACK;");
		}
	}

	console.info("migrate", "Committing results...");
	await db.exec("COMMIT;");
}
