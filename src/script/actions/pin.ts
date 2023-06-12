import { PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget } from "./main.js";

export class PinAction implements Action<PostView> {
	templateize(_cfg: Configuration, _struct: { [key: string]: unknown }) {
		return this;
	}

	async execute(bot: Bot, target: ActionTarget<PostView>): Promise<void> {
		await bot.lemmy.featurePost({
			auth: bot.jwt,
			featured: true,
			feature_type: "Community",
			post_id: target.targetData().post.id,
		});
	}
}
