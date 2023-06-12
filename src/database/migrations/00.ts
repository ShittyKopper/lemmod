import * as sqlite from "sqlite";

export default async function (db: sqlite.Database) {
	await db.exec(`
		CREATE TABLE posts_checked (
			instance_id INTEGER NOT NULL,
			post_id INTEGER NOT NULL,

			UNIQUE(instance_id, post_id) ON CONFLICT IGNORE
		) STRICT;

		CREATE TABLE comments_checked (
			instance_id INTEGER NOT NULL,
			comment_id INTEGER NOT NULL,

			UNIQUE(instance_id, comment_id) ON CONFLICT IGNORE
		) STRICT;

		CREATE TABLE dms_checked (
			creator_id INTEGER NOT NULL,
			message_id INTEGER NOT NULL,

			UNIQUE(creator_id, message_id) ON CONFLICT IGNORE
		) STRICT;
		
		CREATE TABLE community_configs (
			instance_id INTEGER NOT NULL,
			community_id INTEGER NOT NULL,

			config TEXT NOT NULL,

			UNIQUE(instance_id, community_id) ON CONFLICT REPLACE
		) STRICT;

		PRAGMA user_version = 1;
	`);
}
