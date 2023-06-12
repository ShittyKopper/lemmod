import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { sleep } from "../../util.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget, CommentTarget } from "./main.js";

export class ReplyAction implements Action<PostView | CommentView> {
	private message: string;

	constructor(message: string) {
		this.message = message;
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		if (!this.message) return this;
		return new ReplyAction(cfg.templated(this.message, struct));
	}

	async execute(
		bot: Bot,
		target: ActionTarget<PostView | CommentView>
	): Promise<void> {
		const comment = await bot.lemmy.createComment({
			auth: bot.jwt,
			content: this.message,
			post_id: target.targetData().post.id,
			parent_id:
				target instanceof CommentTarget
					? target.targetData().comment.id
					: undefined,
		});

		// doesn't work
		// await bot.lemmy.distinguishComment({
		// 	auth: bot.jwt,
		// 	comment_id: comment.comment_view.comment.id,
		// 	distinguished: true,
		// });
	}
}
