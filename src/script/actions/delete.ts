import { LemmyHttp } from "lemmy-js-client";
import { Configuration } from "../main.js";
import { Action, ActionTarget } from "./main.js";

export class DeleteAction implements Action {
	private message: string;

	constructor(message: string) {
		this.message = message;
	}

	templateize(cfg: Configuration, struct: { [key: string]: unknown }) {
		return new DeleteAction(cfg.templated(this.message, struct));
	}

	execute(lemmy: LemmyHttp, target: ActionTarget): Promise<void> {
		throw new Error("Method not implemented.");
	}
}
