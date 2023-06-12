import { LemmyHttp } from "lemmy-js-client";
import * as sqlite from "sqlite";
import { sleep } from "./util.js";

// https://github.com/LemmyNet/lemmy/blob/main/crates/db_schema/src/utils.rs#L36
const FETCH_LIMIT_MAX = 50;

// we do need to take into account that we want to be almost instant with actions
// while at the same time not hammering already struggling servers
// assuming there will be more comments than posts
const POST_WORKER_WAIT_TIME = 10 * 60 * 1000; // secs
const BETWEEN_POSTS_WORKER_WAIT_TIME = 10 * 1000; // secs
const BETWEEN_POST_PAGES_WORKER_WAIT_TIME = 20 * 1000; // secs

const COMMENT_WORKER_WAIT_TIME = 15 * 60 * 1000; // secs
const BETWEEN_COMMENTS_WORKER_WAIT_TIME = 5 * 60 * 1000; // secs
const BETWEEN_COMMENT_PAGES_WORKER_WAIT_TIME = 10 * 60 * 1000; // secs

const DM_WORKER_WAIT_TIME = 60 * 1000; // secs
const BETWEEN_DMS_WORKER_WAIT_TIME = 5 * 1000; // secs
const BETWEEN_DM_PAGES_WORKER_WAIT_TIME = 10 * 1000; // secs

const PERIODIC_WORKER_WAIT_TIME = 60 * 60 * 1000; // secs

export class Bot {
	private lemmy: LemmyHttp;
	private db: sqlite.Database;
	private jwt: string;

	constructor(lemmy: LemmyHttp, db: sqlite.Database, jwt: string) {
		this.lemmy = lemmy;
		this.db = db;
		this.jwt = jwt;
	}

	async postsWorker() {
		const postsCheckStmt = await this.db.prepare(
			"SELECT 1 FROM posts_checked WHERE instance_id = :instance AND post_id = :post;"
		);

		const postsInsertStmt = await this.db.prepare(
			"INSERT INTO posts_checked(instance_id, post_id) VALUES (:instance, :post);"
		);

		let working = true;
		while (working) {
			let reachedEnd = false;
			let currentPage = 0;

			while (!reachedEnd) {
				console.info("postsWorker", "Getting next", FETCH_LIMIT_MAX, "posts in page", currentPage);

				const posts = await this.lemmy.getPosts({
					auth: this.jwt,
					sort: "New",
					type_: "Subscribed",
					limit: FETCH_LIMIT_MAX,
					page: currentPage,
				});

				console.debug("postsWorker", posts.posts.length, "posts to check");
				for (const post of posts.posts) {
					const dbObj = {
						":instance": post.community.instance_id,
						":post": post.post.id,
					};

					const ret = await postsCheckStmt.get<1>(dbObj);

					if (ret) {
						console.debug(
							"postsWorker",
							"We already checked this post. Assume we checked the older ones as well"
						);
						reachedEnd = true;
						break;
					}

					console.debug("postsWorker", "Found new post", post);
					await postsInsertStmt.run(dbObj);
					await sleep(BETWEEN_POSTS_WORKER_WAIT_TIME);
				}

				if (reachedEnd) break;

				console.debug("postsWorker", "Checking next page");
				currentPage += 1;

				if (currentPage == 5) {
					console.warn(
						"postsWorker",
						"Checked 5 pages without hitting a pre-existing post. Something's off. Assuming this is the end"
					);
					reachedEnd = true;
					break;
				}

				await sleep(BETWEEN_POST_PAGES_WORKER_WAIT_TIME);
			}

			await sleep(POST_WORKER_WAIT_TIME);
			reachedEnd = false;
			currentPage = 0;
		}
	}

	async commentsWorker() {
		const commentsCheckStmt = await this.db.prepare(
			"SELECT 1 FROM comments_checked WHERE instance_id = :instance AND comment_id = :comment;"
		);

		const commentsInsertStmt = await this.db.prepare(
			"INSERT INTO comments_checked(instance_id, comment_id) VALUES (:instance, :comment);"
		);

		let working = true;
		while (working) {
			let reachedEnd = false;
			let currentPage = 0;

			while (!reachedEnd) {
				console.info("commentsWorker", "Getting next", FETCH_LIMIT_MAX, "comments in page", currentPage);
				const comments = await this.lemmy.getComments({
					auth: this.jwt,
					sort: "New",
					type_: "Subscribed",
					limit: FETCH_LIMIT_MAX,
					page: 1,
				});

				console.debug("commentsWorker", comments.comments.length, "comments to check");
				for (const comment of comments.comments) {
					const dbObj = {
						":instance": comment.community.instance_id,
						":comment": comment.comment.id,
					};

					const ret = await commentsCheckStmt.get<1>(dbObj);

					if (ret) {
						console.debug(
							"commentsWorker",
							"We already checked this comment. Assume we checked the older ones as well"
						);
						reachedEnd = true;
						break;
					}

					console.debug("commentsWorker", "Found new comment", comment);
					await commentsInsertStmt.run(dbObj);
					await sleep(BETWEEN_COMMENTS_WORKER_WAIT_TIME);
				}

				if (reachedEnd) break;
				console.debug("commentsWorker", "Checking next page");
				currentPage += 1;

				if (currentPage == 5) {
					console.warn(
						"commentsWorker",
						"Checked 5 pages without hitting a pre-existing comment. Something's off. Assuming this is the end"
					);
					reachedEnd = true;
					break;
				}

				await sleep(BETWEEN_COMMENT_PAGES_WORKER_WAIT_TIME);
			}

			await sleep(COMMENT_WORKER_WAIT_TIME);
			reachedEnd = false;
			currentPage = 0;
		}
	}

	async dmsWorker() {
		const dmsCheckStmt = await this.db.prepare(
			"SELECT 1 FROM dms_checked WHERE creator_id = :creator AND message_id = :message;"
		);

		const dmsInsertStmt = await this.db.prepare(
			"INSERT INTO dms_checked(creator_id, message_id) VALUES (:creator, :message);"
		);

		let working = true;
		while (working) {
			let reachedEnd = false;
			let currentPage = 0;

			while (!reachedEnd) {
				console.info("dmsWorker", "Getting next", FETCH_LIMIT_MAX, "DMs in page", currentPage);
				const dms = await this.lemmy.getPrivateMessages({
					auth: this.jwt,
					limit: FETCH_LIMIT_MAX,
					page: currentPage,
				});

				console.debug("dmsWorker", dms.private_messages.length, "DMs to check");
				if (dms.private_messages.length == 0) {
					reachedEnd = true;
					break;
				}

				for (const dm of dms.private_messages) {
					const dbObj = {
						":creator": dm.creator.id,
						":message": dm.private_message.id,
					};

					const ret = await dmsCheckStmt.get<1>(dbObj);

					if (ret) {
						continue;
					}

					console.debug("dmsWorker", "Found new DM", dm);
					await dmsInsertStmt.run(dbObj);
					await sleep(BETWEEN_DMS_WORKER_WAIT_TIME);
				}

				if (reachedEnd) break;
				console.debug("dmsWorker", "Checking next page");
				currentPage += 1;

				if (currentPage == 5) {
					console.warn(
						"commentsWorker",
						"Checked 5 pages without hitting a pre-existing DM. Something's off. Assuming this is the end"
					);
					reachedEnd = true;
					break;
				}

				await sleep(BETWEEN_DM_PAGES_WORKER_WAIT_TIME);
			}

			await sleep(DM_WORKER_WAIT_TIME);
			reachedEnd = false;
			currentPage = 0;
		}
	}

	async periodicWorker() {
		let working = true;
		while (working) {
			await sleep(PERIODIC_WORKER_WAIT_TIME);

			console.info("periodicWorker", "Optimizing database...");
			await this.db.exec(`
				PRAGMA incremental_vacuum;
				PRAGMA optimize;
			`);
		}
	}

	async start() {
		await Promise.all([this.postsWorker(), this.commentsWorker(), this.dmsWorker(), this.periodicWorker()]);
	}
}
