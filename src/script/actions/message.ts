import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget } from "./main.js";

export class MessageAction implements Action<PostView | CommentView> {
	private message: string;

	constructor(message: string) {
		this.message = message;
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		if (!this.message) return this;
		return new MessageAction(cfg.templated(this.message, struct));
	}

	async execute(bot: Bot, target: ActionTarget<PostView | CommentView>): Promise<void> {
		const creator_id = target.targetData().creator.id;
		await bot.lemmy.createPrivateMessage({ auth: bot.jwt, recipient_id: creator_id, content: this.message });
	}
}
