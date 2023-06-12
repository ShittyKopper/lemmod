import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget, CommentTarget, PostTarget } from "./main.js";

export class ReportAction implements Action<PostView | CommentView> {
	private message: string;

	constructor(message: string) {
		this.message = message;
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		if (!this.message) return this;
		return new ReportAction(cfg.templated(this.message, struct));
	}

	async execute(bot: Bot, target: ActionTarget<PostView | CommentView>): Promise<void> {
		if (target instanceof PostTarget) {
			await bot.lemmy.createPostReport({
				auth: bot.jwt,
				reason: this.message,
				post_id: target.targetData().post.id,
			});
		} else if (target instanceof CommentTarget) {
			await bot.lemmy.createCommentReport({
				auth: bot.jwt,
				reason: this.message,
				comment_id: target.targetData().comment.id,
			});
		}
	}
}
