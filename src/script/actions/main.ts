import { CommentView, PostView } from "lemmy-js-client";
import { LRUCache } from "lru-cache/min";
import RE2 from "re2";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { OnComment, OnPost, Text } from "../schema.js";
import { DeleteAction } from "./delete.js";
import { LockAction } from "./lock.js";
import { MessageAction } from "./message.js";

export interface ActionTarget<TargetData> {
	match(input: unknown): [boolean, { [regexGroupName: string]: string }];
	targetData(): TargetData;
}

export interface Action<TargetData> {
	templateize(cfg: Configuration, struct: { [key: string]: unknown }): Action<TargetData>;
	execute(bot: Bot, target: ActionTarget<TargetData>): Promise<void>;
}

export class PostTarget implements ActionTarget<PostView> {
	private matcher: OnPost;
	private cfg: Configuration;

	private regexCache: LRUCache<string, RE2, unknown>;

	private data?: PostView;

	constructor(matcher: OnPost, cfg: Configuration) {
		this.matcher = matcher;
		this.cfg = cfg;

		this.regexCache = new LRUCache({ max: 50 });
	}

	targetData(): PostView {
		if (!this.data) {
			throw "targetData() called before match()";
		}

		return this.data;
	}

	templateizeText(text: Text, struct: OnPost): Text {
		if (typeof text == "string") {
			text = this.cfg.templated(text, struct);
		} else {
			text.regex.match = this.cfg.templated(text.regex.match, struct);
		}

		return text;
	}

	// there must be a better way for this
	templateize(struct: OnPost): OnPost {
		const templatedMatcher = this.matcher;

		if (templatedMatcher.body != undefined) {
			templatedMatcher.body = this.templateizeText(templatedMatcher.body, struct);
		}

		if (templatedMatcher.creator != undefined) {
			if (templatedMatcher.creator.display_name != undefined) {
				templatedMatcher.creator.display_name = this.templateizeText(
					templatedMatcher.creator.display_name,
					struct
				);
			}

			if (templatedMatcher.creator.name != undefined) {
				templatedMatcher.creator.name = this.templateizeText(templatedMatcher.creator.name, struct);
			}
		}

		if (templatedMatcher.embed != undefined) {
			if (templatedMatcher.embed.description != undefined) {
				templatedMatcher.embed.description = this.templateizeText(templatedMatcher.embed.description, struct);
			}

			if (templatedMatcher.embed.title != undefined) {
				templatedMatcher.embed.title = this.templateizeText(templatedMatcher.embed.title, struct);
			}
		}

		if (templatedMatcher.title != undefined) {
			templatedMatcher.title = this.templateizeText(templatedMatcher.title, struct);
		}

		if (templatedMatcher.url != undefined) {
			if (typeof templatedMatcher.url == "string" || "regex" in templatedMatcher.url) {
				templatedMatcher.url = this.templateizeText(templatedMatcher.url, struct);
			} else {
				if (templatedMatcher.url.domain != undefined) {
					templatedMatcher.url.domain = this.templateizeText(templatedMatcher.url.domain, struct);
				}

				if (templatedMatcher.url.hash != undefined) {
					templatedMatcher.url.hash = this.templateizeText(templatedMatcher.url.hash, struct);
				}

				if (templatedMatcher.url.path != undefined) {
					templatedMatcher.url.path = this.templateizeText(templatedMatcher.url.path, struct);
				}

				if (templatedMatcher.url.query != undefined) {
					templatedMatcher.url.query = this.templateizeText(templatedMatcher.url.query, struct);
				}
			}
		}

		return templatedMatcher;
	}

	matchText(a: Text, b: Text): [boolean, { [regexGroupName: string]: string }] {
		const reGroups: { [key: string]: string } = {};

		if (typeof a == "string" && typeof b == "string") {
			return [a == b, {}];
		}

		if (typeof a != "string" && "regex" in a && typeof b == "string") {
			let regex = this.regexCache.get(a.regex.match);
			if (!regex) {
				regex = new RE2(a.regex.match);
				this.regexCache.set(a.regex.match, regex);
			}

			const results = regex.exec(b);
			if (results == null) {
				return [false, {}];
			}

			if (a.regex.save_groups != undefined && results.groups != undefined) {
				const groups = Object.keys(results.groups);
				const groupSaved = groups.filter(k => a.regex.save_groups?.includes(k));
				for (const k of groupSaved) {
					reGroups[k] = results.groups[k];
				}
			}
		}

		if (typeof b != "string" && "regex" in b && typeof a == "string") {
			return this.matchText(b, a); // fuck you
		}

		return [true, reGroups];
	}

	match(input: PostView): [boolean, { [regexGroupName: string]: string }] {
		let templateVariables: { [key: string]: string } = {};

		const url = input.post.url ? new URL(input.post.url) : undefined;
		const post: OnPost = {
			creator: {
				admin: input.creator.admin,
				bot: input.creator.bot_account,
				display_name: input.creator.display_name,
				name: input.creator.name,
				local: input.creator.local,
			},
			body: input.post.body,
			embed: {
				description: input.post.embed_description,
				title: input.post.embed_title,
			},
			nsfw: input.post.nsfw,
			title: input.post.name,
			url: {
				domain: url?.hostname,
				hash: url?.hash,
				path: url?.pathname,
				query: url?.search,
			},
		};

		const templatedMatcher = this.templateize(post);

		if (templatedMatcher.body && post.body) {
			const [match, reGroup] = this.matchText(templatedMatcher.body, post.body);
			if (!match) return [false, {}];
			templateVariables = { ...templateVariables, ...reGroup };
		}

		if (templatedMatcher.creator) {
			if (
				templatedMatcher.creator?.admin != post.creator?.admin ||
				templatedMatcher.creator?.bot != post.creator?.bot ||
				templatedMatcher.creator?.local != post.creator?.local
			) {
				return [false, {}];
			}

			if (templatedMatcher.creator.name && post.creator?.name) {
				const [match, reGroup] = this.matchText(templatedMatcher.creator?.name, post.creator.name);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}

			if (templatedMatcher.creator.display_name && post.creator?.display_name) {
				const [match, reGroup] = this.matchText(
					templatedMatcher.creator?.display_name,
					post.creator.display_name
				);

				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}
		}

		if (templatedMatcher.embed) {
			if (templatedMatcher.embed.description && post.embed?.description) {
				const [match, reGroup] = this.matchText(templatedMatcher.embed.description, post.embed.description);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}

			if (templatedMatcher.embed.title && post.embed?.title) {
				const [match, reGroup] = this.matchText(templatedMatcher.embed.title, post.embed.title);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}
		}

		if (templatedMatcher.nsfw != undefined && post.nsfw != undefined && templatedMatcher.nsfw != post.nsfw) {
			return [false, {}];
		}

		if (templatedMatcher.title && post.title) {
			const [match, reGroup] = this.matchText(templatedMatcher.title, post.title);
			if (!match) return [false, {}];
			templateVariables = { ...templateVariables, ...reGroup };
		}

		if (templatedMatcher.url) {
			if (typeof templatedMatcher.url == "string" || "regex" in templatedMatcher.url) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const [match, reGroup] = this.matchText(templatedMatcher.url, input.post.url!); // fuck
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			} else {
				if (post.url && typeof post.url != "string" && "domain" in post.url) {
					if (templatedMatcher.url.domain && post.url.domain) {
						const [match, reGroup] = this.matchText(templatedMatcher.url.domain, post.url.domain);
						if (!match) return [false, {}];
						templateVariables = { ...templateVariables, ...reGroup };
					}

					if (templatedMatcher.url.hash && post.url.hash) {
						const [match, reGroup] = this.matchText(templatedMatcher.url.hash, post.url.hash);
						if (!match) return [false, {}];
						templateVariables = { ...templateVariables, ...reGroup };
					}

					if (templatedMatcher.url.path && post.url.path) {
						const [match, reGroup] = this.matchText(templatedMatcher.url.path, post.url.path);
						if (!match) return [false, {}];
						templateVariables = { ...templateVariables, ...reGroup };
					}

					if (templatedMatcher.url.query && post.url.query) {
						const [match, reGroup] = this.matchText(templatedMatcher.url.query, post.url.query);
						if (!match) return [false, {}];
						templateVariables = { ...templateVariables, ...reGroup };
					}
				}
			}
		}

		this.data = input;

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		return [true, { ...templateVariables, post }];
	}
}

export class CommentTarget implements ActionTarget<CommentView> {
	private matcher: OnComment;
	private cfg: Configuration;

	private data?: CommentView;

	constructor(matcher: OnComment, cfg: Configuration) {
		this.matcher = matcher;
		this.cfg = cfg;
	}
	targetData(): CommentView {
		if (!this.data) {
			throw "targetData() called before match()";
		}

		return this.data;
	}

	match(input: CommentView): [boolean, { [regexGroupName: string]: string }] {
		return [false, {}]; // TODO
	}
}

export function getActionByName(name: string): unknown {
	switch (name) {
		case "delete":
			return DeleteAction;

		case "message":
			return MessageAction;

		case "lock":
			return LockAction;

		default:
			throw `Unknown action "${name}"`;
	}
}
