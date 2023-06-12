import { LemmyHttp, MyUserInfo, PrivateMessageView } from "lemmy-js-client";
import { LRUCache } from "lru-cache";
import * as sqlite from "sqlite";
import { Configuration } from "./script/main.js";
import { sleep } from "./util.js";

// https://github.com/LemmyNet/lemmy/blob/main/crates/db_schema/src/utils.rs#L36
const FETCH_LIMIT_MAX = 50;

const LRU_CACHE_MAX = 100;

// we do need to take into account that we want to be almost instant with actions
// while at the same time not hammering already struggling servers

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

const POST_WORKER_WAIT_TIME = 2 * MINUTES;
const BETWEEN_POSTS_WORKER_WAIT_TIME = 2 * SECONDS;
const BETWEEN_POST_PAGES_WORKER_WAIT_TIME = 20 * SECONDS;

const COMMENT_WORKER_WAIT_TIME = 1 * MINUTES;
const BETWEEN_COMMENTS_WORKER_WAIT_TIME = 2 * SECONDS;
const BETWEEN_COMMENT_PAGES_WORKER_WAIT_TIME = 10 * SECONDS;

const DM_WORKER_WAIT_TIME = 2 * MINUTES;
const BETWEEN_DMS_WORKER_WAIT_TIME = 2 * SECONDS;
const BETWEEN_DM_PAGES_WORKER_WAIT_TIME = 10 * SECONDS;

const FAST_PERIODIC_WORKER_WAIT_TIME = 2 * MINUTES;
const SLOW_PERIODIC_WORKER_WAIT_TIME = 10 * MINUTES;

export class Bot {
	public lemmy: LemmyHttp;
	public jwt: string;

	private db: sqlite.Database;
	private configCache: LRUCache<[number, number], Configuration, unknown>;
	private configGetStmt?: sqlite.Statement;
	private configSetStmt?: sqlite.Statement;

	private me?: MyUserInfo;

	constructor(lemmy: LemmyHttp, db: sqlite.Database, jwt: string) {
		this.lemmy = lemmy;
		this.db = db;
		this.jwt = jwt;

		this.configCache = new LRUCache({ max: LRU_CACHE_MAX });
	}

	async getConfig(instance_id: number, community_id: number): Promise<Configuration | null> {
		const cached = this.configCache.get([instance_id, community_id]);
		if (cached != undefined) {
			return cached;
		}

		if (!this.configGetStmt) {
			this.configGetStmt = await this.db.prepare(
				"SELECT config FROM community_configs WHERE instance_id = :instance AND community_id = :community;"
			);
		}

		const configurationYml = await this.configGetStmt.get<{ config: string }>({
			":instance": instance_id,
			":community": community_id,
		});

		if (!configurationYml) {
			return null;
		}

		const configuration = new Configuration(configurationYml?.config);
		this.configCache.set([instance_id, community_id], configuration);
		return configuration;
	}

	async syncFollows() {
		console.info("syncFollows", "Synchronizing followed communities...");
		const site = await this.lemmy.getSite({ auth: this.jwt });

		this.me = site.my_user;
		const moderates = this.me?.moderates || [];
		const follows = this.me?.follows || [];

		const simplifiedModerates = moderates.map(m => m.community.id);
		const simplifiedFollows = follows.map(f => f.community.id);

		const followNotMod = simplifiedFollows.filter(x => !simplifiedModerates.includes(x));
		for (const follow of followNotMod) {
			const fullFollow = follows.find(f => f.community.id == follow);
			console.info("syncFollows", "unfollowing", fullFollow?.community.name, "as we're not a mod anymore");
			await this.lemmy.followCommunity({ auth: this.jwt, community_id: follow, follow: false });
		}

		const modNotFollow = simplifiedModerates.filter(x => !simplifiedFollows.includes(x));
		for (const follow of modNotFollow) {
			const fullFollow = follows.find(f => f.community.id == follow);
			console.info("syncFollows", "following", fullFollow?.community.name, "as we're a mod now");
			await this.lemmy.followCommunity({ auth: this.jwt, community_id: follow, follow: true });
		}
	}

	async handleDM(dm: PrivateMessageView) {
		const content = dm.private_message.content;
		const lines = content.trim().split("\n");

		const reply = async (content: string) =>
			await this.lemmy.createPrivateMessage({ auth: this.jwt, recipient_id: dm.creator.id, content });

		if (lines.length < 1) {
			await reply("Invalid DM command, please read the documentation.");
			return;
		}

		const line = lines[0].trim();
		if (!(line.startsWith("!") && line.includes("@"))) {
			await reply("Invalid community format, please read the documentation.");
			return;
		}

		const resolved = await this.lemmy.resolveObject({ auth: this.jwt, q: line });
		const community = resolved.community?.community;

		if (!community) {
			await reply("Unknown community.");
			return;
		}

		const community2 = await this.lemmy.getCommunity({ auth: this.jwt, id: community.id });
		const moderators = community2.moderators;

		const mod = moderators.find(
			mod => mod.moderator.id == dm.creator.id && mod.moderator.instance_id == dm.creator.instance_id
		);

		if (!mod) {
			await reply("You are not a moderator of that community.");
			return;
		}

		const meMod = moderators.find(
			mod =>
				mod.moderator.id == this.me?.local_user_view.person.id &&
				mod.moderator.instance_id == this.me.local_user_view.person.instance_id
		);

		if (!meMod) {
			await reply("I am not a moderator of that community.");
			return;
		}

		if (lines.length > 3) {
			if (lines[1].trim() != "```" && lines[lines.length - 1].trim() != "```") {
				await reply("Invalid DM command, please read the documentation.");
				return;
			}

			try {
				const configurationYml = lines.slice(2, -1).join("\n");
				const configuration = new Configuration(configurationYml);

				if (!this.configSetStmt) {
					this.configSetStmt = await this.db.prepare(
						"INSERT OR REPLACE INTO community_configs(instance_id, community_id, config) VALUES (:instance, :community, :config);"
					);
				}

				await this.configSetStmt.run({
					":instance": community.instance_id,
					":community": community.id,
					":config": configurationYml,
				});

				this.configCache.set([community.instance_id, community.id], configuration);
				await reply(
					`Community **${community.name}** is now using the following configuration:\n\`\`\`\n${configurationYml}\n\`\`\``
				);

				// ok!
			} catch (e) {
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				await reply(`An error occured while applying your config: ${e}`);
				console.error("handleDM", "Error setting community config", e);
				return;
			}
		} else {
			const config = await this.getConfig(community.instance_id, community.id);
			if (!config) {
				await reply(`Community **${community.name}** does not have any configuration`);
				return;
			}

			await reply(
				`Community **${community.name}** is using the following configuration:\n\`\`\`\n${config.yml}\n\`\`\``
			);
			return;
		}
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
				if (posts.posts.length == 0) {
					reachedEnd = true;
					break;
				}

				for (const post of posts.posts) {
					const dbObj = {
						":instance": post.community.instance_id,
						":post": post.post.id,
					};

					// Lemmy upvotes own posts by default IIRC
					if (post.my_vote && post.my_vote > 0) return;

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

					const config = await this.getConfig(post.community.instance_id, post.community.id);
					if (!config) {
						console.warn("Community", post.community.name, "has not uploaded a configuration.");
						continue;
					}

					await config.handlePost(post, this);

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
				if (comments.comments.length == 0) {
					reachedEnd = true;
					break;
				}

				for (const comment of comments.comments) {
					const dbObj = {
						":instance": comment.community.instance_id,
						":comment": comment.comment.id,
					};

					// Lemmy upvotes own comments by default IIRC
					if (comment.my_vote && comment.my_vote > 0) return;

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

					const config = await this.getConfig(comment.community.instance_id, comment.community.id);
					if (!config) {
						console.warn("Community", comment.community.name, "has not uploaded a configuration.");
						continue;
					}

					await config.handleComment(comment, this);

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

		while (!this.me) {
			console.debug("dmsWorker", "Spinning until moderation's synced");
			await sleep(5 * SECONDS);
		}

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

					if (
						dm.creator.id == this.me.local_user_view.person.id &&
						dm.creator.instance_id == this.me.local_user_view.person.instance_id
					)
						continue;

					const ret = await dmsCheckStmt.get<1>(dbObj);

					if (ret) {
						continue;
					}

					console.debug("dmsWorker", "Found new DM", dm);

					await this.handleDM(dm);

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

	async fastPeriodicWorker() {
		let working = true;
		while (working) {
			await this.syncFollows();
			await sleep(FAST_PERIODIC_WORKER_WAIT_TIME);
		}
	}
	async slowPeriodicWorker() {
		let working = true;
		while (working) {
			await sleep(SLOW_PERIODIC_WORKER_WAIT_TIME);

			console.info("slowPeriodicWorker", "Optimizing database...");
			await this.db.exec(`
				PRAGMA incremental_vacuum;
				PRAGMA optimize;
			`);
		}
	}

	async start() {
		await Promise.all([
			this.postsWorker(),
			this.commentsWorker(),
			this.dmsWorker(),
			this.slowPeriodicWorker(),
			this.fastPeriodicWorker(),
		]);
	}
}
