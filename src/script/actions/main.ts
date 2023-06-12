import { Bot } from "../../bot.js";
import { OnComment, OnPost } from "../schema.js";
import { DeleteAction } from "./delete.js";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ActionTarget {}

export interface Action {
	execute(bot: Bot, target: ActionTarget): Promise<void>;
}

export class PostTarget implements ActionTarget {
	private target: OnPost;

	constructor(target: OnPost) {
		this.target = target;
	}
}

export class CommentTarget implements ActionTarget {
	private target: OnComment;

	constructor(target: OnComment) {
		this.target = target;
	}
}

export function getActionByName(name: string): { new (): Action } {
	switch (name) {
		case "delete":
			return DeleteAction;

		default:
			throw `Unknown action "${name}"`;
	}
}
