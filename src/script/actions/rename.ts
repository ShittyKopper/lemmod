import { PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget } from "./main.js";

export class RenameAction implements Action<PostView> {
	private title: string;

	constructor(title: string) {
		this.title = title;
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		if (!this.title) return this;
		return new RenameAction(cfg.templated(this.title, struct));
	}

	async execute(bot: Bot, target: ActionTarget<PostView>): Promise<void> {
		await bot.lemmy.editPost({
			auth: bot.jwt,
			post_id: target.targetData().post.id,
			name: this.title,
		});
	}
}
