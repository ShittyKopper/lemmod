import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget, CommentTarget, PostTarget } from "./main.js";

export class DeleteAction implements Action<PostView | CommentView> {
	private message: string;

	constructor(message: string) {
		this.message = message;
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		if (!this.message) return this;
		return new DeleteAction(cfg.templated(this.message, struct));
	}

	async execute(bot: Bot, target: ActionTarget<PostView | CommentView>): Promise<void> {
		if (target instanceof PostTarget) {
			await bot.lemmy.deletePost({ auth: bot.jwt, deleted: true, post_id: target.targetData().post.id });
		} else if (target instanceof CommentTarget) {
			await bot.lemmy.deleteComment({ auth: bot.jwt, deleted: true, comment_id: target.targetData().comment.id });
		}
	}
}
