import { CommentView, PostView } from "lemmy-js-client";
import { Bot } from "../../bot.js";
import { Configuration } from "../main.js";
import { Action, ActionTarget } from "./main.js";

interface BanArgs {
	reason?: string;
	expires?: number;
}

export class BanAction implements Action<PostView | CommentView> {
	private args: BanArgs;

	constructor(args?: string | BanArgs) {
		if (args == undefined) {
			this.args = {};
		} else if (typeof args == "string") {
			this.args = { reason: args };
		} else {
			this.args = args;
		}
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		if (!this.args.reason) return this;
		return new BanAction({ reason: cfg.templated(this.args.reason, struct), expires: this.args.expires });
	}

	async execute(bot: Bot, target: ActionTarget<PostView | CommentView>): Promise<void> {
		const targetData = target.targetData();
		await bot.lemmy.banFromCommunity({
			auth: bot.jwt,
			ban: true,

			community_id: targetData.community.id,
			person_id: targetData.creator.id,

			expires: this.args.expires,
			reason: this.args.reason,
		});
	}
}
