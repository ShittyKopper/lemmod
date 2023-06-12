import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { OnComment, OnPost, Text } from "../schema.js";
import { templateizeText as innerTemplateizeText, matchText } from "../util.js";
import { BanAction } from "./ban.js";
import { DeleteAction } from "./delete.js";
import { LockAction } from "./lock.js";
import { MessageAction } from "./message.js";
import { PinAction } from "./pin.js";
import { RenameAction } from "./rename.js";
import { ReplyAction } from "./reply.js";
import { ReportAction } from "./report.js";

export interface ActionTarget<TargetData> {
	match(input: unknown): [boolean, { [regexGroupName: string]: string }];
	targetData(): TargetData;
}

export interface Action<TargetData> {
	templateize(
		cfg: Configuration,
		struct: { [key: string]: unknown }
	): Action<TargetData>;
	execute(bot: Bot, target: ActionTarget<TargetData>): Promise<void>;
}

export class PostTarget implements ActionTarget<PostView> {
	private matcher: OnPost;
	private cfg: Configuration;

	private data?: PostView;

	constructor(matcher: OnPost, cfg: Configuration) {
		this.matcher = matcher;
		this.cfg = cfg;
	}

	targetData(): PostView {
		if (!this.data) {
			throw "targetData() called before match()";
		}

		return this.data;
	}

	templateizeText(text: Text, struct: OnPost): Text {
		return innerTemplateizeText(this.cfg, text, struct);
	}

	// there must be a better way for this
	templateize(struct: OnPost): OnPost {
		const templatedMatcher = this.matcher;

		if (templatedMatcher.body != undefined) {
			templatedMatcher.body = this.templateizeText(
				templatedMatcher.body,
				struct
			);
		}

		if (templatedMatcher.creator != undefined) {
			if (templatedMatcher.creator.display_name != undefined) {
				templatedMatcher.creator.display_name = this.templateizeText(
					templatedMatcher.creator.display_name,
					struct
				);
			}

			if (templatedMatcher.creator.name != undefined) {
				templatedMatcher.creator.name = this.templateizeText(
					templatedMatcher.creator.name,
					struct
				);
			}
		}

		if (templatedMatcher.embed != undefined) {
			if (templatedMatcher.embed.description != undefined) {
				templatedMatcher.embed.description = this.templateizeText(
					templatedMatcher.embed.description,
					struct
				);
			}

			if (templatedMatcher.embed.title != undefined) {
				templatedMatcher.embed.title = this.templateizeText(
					templatedMatcher.embed.title,
					struct
				);
			}
		}

		if (templatedMatcher.title != undefined) {
			templatedMatcher.title = this.templateizeText(
				templatedMatcher.title,
				struct
			);
		}

		if (templatedMatcher.url != undefined) {
			if (
				typeof templatedMatcher.url == "string" ||
				"regex" in templatedMatcher.url
			) {
				templatedMatcher.url = this.templateizeText(
					templatedMatcher.url,
					struct
				);
			} else {
				if (templatedMatcher.url.domain != undefined) {
					templatedMatcher.url.domain = this.templateizeText(
						templatedMatcher.url.domain,
						struct
					);
				}

				if (templatedMatcher.url.hash != undefined) {
					templatedMatcher.url.hash = this.templateizeText(
						templatedMatcher.url.hash,
						struct
					);
				}

				if (templatedMatcher.url.path != undefined) {
					templatedMatcher.url.path = this.templateizeText(
						templatedMatcher.url.path,
						struct
					);
				}

				if (templatedMatcher.url.query != undefined) {
					templatedMatcher.url.query = this.templateizeText(
						templatedMatcher.url.query,
						struct
					);
				}
			}
		}

		return templatedMatcher;
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
			const [match, reGroup] = matchText(
				templatedMatcher.body,
				post.body
			);
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
				const [match, reGroup] = matchText(
					templatedMatcher.creator?.name,
					post.creator.name
				);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}

			if (
				templatedMatcher.creator.display_name &&
				post.creator?.display_name
			) {
				const [match, reGroup] = matchText(
					templatedMatcher.creator?.display_name,
					post.creator.display_name
				);

				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}
		}

		if (templatedMatcher.embed) {
			if (templatedMatcher.embed.description && post.embed?.description) {
				const [match, reGroup] = matchText(
					templatedMatcher.embed.description,
					post.embed.description
				);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}

			if (templatedMatcher.embed.title && post.embed?.title) {
				const [match, reGroup] = matchText(
					templatedMatcher.embed.title,
					post.embed.title
				);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}
		}

		if (
			templatedMatcher.nsfw != undefined &&
			post.nsfw != undefined &&
			templatedMatcher.nsfw != post.nsfw
		) {
			return [false, {}];
		}

		if (templatedMatcher.title && post.title) {
			const [match, reGroup] = matchText(
				templatedMatcher.title,
				post.title
			);
			if (!match) return [false, {}];
			templateVariables = { ...templateVariables, ...reGroup };
		}

		if (templatedMatcher.url) {
			if (
				typeof templatedMatcher.url == "string" ||
				"regex" in templatedMatcher.url
			) {
				const [match, reGroup] = matchText(
					templatedMatcher.url,

					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					input.post.url!
				); // fuck
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			} else {
				if (
					post.url &&
					typeof post.url != "string" &&
					"domain" in post.url
				) {
					if (templatedMatcher.url.domain && post.url.domain) {
						const [match, reGroup] = matchText(
							templatedMatcher.url.domain,
							post.url.domain
						);
						if (!match) return [false, {}];
						templateVariables = {
							...templateVariables,
							...reGroup,
						};
					}

					if (templatedMatcher.url.hash && post.url.hash) {
						const [match, reGroup] = matchText(
							templatedMatcher.url.hash,
							post.url.hash
						);
						if (!match) return [false, {}];
						templateVariables = {
							...templateVariables,
							...reGroup,
						};
					}

					if (templatedMatcher.url.path && post.url.path) {
						const [match, reGroup] = matchText(
							templatedMatcher.url.path,
							post.url.path
						);
						if (!match) return [false, {}];
						templateVariables = {
							...templateVariables,
							...reGroup,
						};
					}

					if (templatedMatcher.url.query && post.url.query) {
						const [match, reGroup] = matchText(
							templatedMatcher.url.query,
							post.url.query
						);
						if (!match) return [false, {}];
						templateVariables = {
							...templateVariables,
							...reGroup,
						};
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

	templateizeText(text: Text, struct: OnComment): Text {
		return innerTemplateizeText(this.cfg, text, struct);
	}

	// there must be a better way for this
	templateize(struct: OnComment): OnComment {
		const templatedMatcher = this.matcher;

		if (templatedMatcher.body != undefined) {
			templatedMatcher.body = this.templateizeText(
				templatedMatcher.body,
				struct
			);
		}

		if (templatedMatcher.creator != undefined) {
			if (templatedMatcher.creator.display_name != undefined) {
				templatedMatcher.creator.display_name = this.templateizeText(
					templatedMatcher.creator.display_name,
					struct
				);
			}

			if (templatedMatcher.creator.name != undefined) {
				templatedMatcher.creator.name = this.templateizeText(
					templatedMatcher.creator.name,
					struct
				);
			}
		}

		return templatedMatcher;
	}

	match(input: CommentView): [boolean, { [regexGroupName: string]: string }] {
		let templateVariables: { [key: string]: string } = {};

		const comment: OnComment = {
			creator: {
				admin: input.creator.admin,
				bot: input.creator.bot_account,
				display_name: input.creator.display_name,
				name: input.creator.name,
				local: input.creator.local,
			},
			body: input.comment.content,
		};

		const templatedMatcher = this.templateize(comment);

		if (templatedMatcher.body && comment.body) {
			const [match, reGroup] = matchText(
				templatedMatcher.body,
				comment.body
			);
			if (!match) return [false, {}];
			templateVariables = { ...templateVariables, ...reGroup };
		}

		if (templatedMatcher.creator) {
			if (
				templatedMatcher.creator?.admin != comment.creator?.admin ||
				templatedMatcher.creator?.bot != comment.creator?.bot ||
				templatedMatcher.creator?.local != comment.creator?.local
			) {
				return [false, {}];
			}

			if (templatedMatcher.creator.name && comment.creator?.name) {
				const [match, reGroup] = matchText(
					templatedMatcher.creator?.name,
					comment.creator.name
				);
				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}

			if (
				templatedMatcher.creator.display_name &&
				comment.creator?.display_name
			) {
				const [match, reGroup] = matchText(
					templatedMatcher.creator?.display_name,
					comment.creator.display_name
				);

				if (!match) return [false, {}];
				templateVariables = { ...templateVariables, ...reGroup };
			}
		}

		this.data = input;

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		return [true, { ...templateVariables, comment }];
	}
}

export function getActionByName(name: string): unknown {
	switch (name) {
		case "ban":
			return BanAction;

		case "delete":
			return DeleteAction;

		case "lock":
			return LockAction;

		case "message":
			return MessageAction;

		case "pin":
			return PinAction;

		case "rename":
			return RenameAction;

		case "reply":
			return ReplyAction;

		case "report":
			return ReportAction;

		default:
			throw `Unknown action "${name}"`;
	}
}
