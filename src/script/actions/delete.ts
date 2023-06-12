import { Bot } from "../../bot.js";
import { Action, ActionTarget } from "./main.js";

export class DeleteAction implements Action {
	execute(bot: Bot, target: ActionTarget): Promise<void> {
		throw new Error("Method not implemented.");
	}
}
