import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget, CommentTarget, PostTarget } from "./main.js";

export class DeleteAction implements Action<PostView | CommentView> {
	templateize(_cfg: Configuration, _struct: { [key: string]: unknown }) {
		return this;
	}

	async execute(bot: Bot, target: ActionTarget<PostView | CommentView>): Promise<void> {
		if (target instanceof PostTarget) {
			await bot.lemmy.deletePost({ auth: bot.jwt, deleted: true, post_id: target.targetData().post.id });
		} else if (target instanceof CommentTarget) {
			await bot.lemmy.deleteComment({ auth: bot.jwt, deleted: true, comment_id: target.targetData().comment.id });
		}
	}
}
