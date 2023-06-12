import * as yaml from "js-yaml";
import { CommentView, PostView } from "lemmy-js-client";
import Mustache from "mustache";
import { Bot } from "../bot.js";
import { Action, CommentTarget, getActionByName, PostTarget, ActionTarget as Target } from "./actions/main.js";
import { Script as ScriptSchema } from "./schema.js";

interface ConfigurationFile {
	variables: { [name: string]: string };
	script: ScriptSchema[];
}

class Script {
	private cfg: Configuration;

	private actions: Action<unknown>[];
	public target: Target<unknown>;

	constructor(script: ScriptSchema, cfg: Configuration) {
		this.cfg = cfg;

		if ("new" in script.on && script.on.new == "post") {
			this.target = new PostTarget(script.on, cfg);
		} else if ("new" in script.on && script.on.new == "comment") {
			this.target = new CommentTarget(script.on, cfg);
		} else {
			throw `Invalid action target`;
		}

		this.actions = [];
		for (const [action, args] of Object.entries(script.actions)) {
			const actionClass = getActionByName(action);

			let actionInit;
			if (args != null) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/ban-ts-comment
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				actionInit = new actionClass(args);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/ban-ts-comment
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				actionInit = new actionClass();
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			this.actions.push(actionInit);
		}
	}

	public async handlePost(post: PostView, bot: Bot) {
		const [match, templateVariables] = this.target.match(post);
		if (!match) return;

		const actions = this.actions.map(act => act.templateize(this.cfg, templateVariables).execute(bot, this.target));
		await Promise.all(actions);
	}

	public async handleComment(comment: CommentView, bot: Bot) {
		const [match, templateVariables] = this.target.match(comment);
		if (!match) return;

		const actions = this.actions.map(act => act.templateize(this.cfg, templateVariables).execute(bot, this.target));
		await Promise.all(actions);
	}
}

export class Configuration {
	private variables: { [name: string]: string };
	private scripts: Script[];
	public yml: string;

	constructor(yamlSrc: string) {
		this.yml = yamlSrc;
		const config = yaml.load(this.yml, { schema: yaml.FAILSAFE_SCHEMA }) as ConfigurationFile;

		this.variables = {};
		if (config.variables) {
			for (const [key, value] of Object.entries(config.variables)) {
				if (typeof key != "string") {
					// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
					throw `Variables key "${key}" is not a string!`;
				}

				if (key in ["post", "comment", "creator"]) {
					throw `Variables key "${key}" is forbidden!`;
				}

				if (typeof value != "string") {
					// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
					throw `Variables value "${value}" is not a string!`;
				}

				this.variables[key] = this.templated(value, {});
			}
		}

		this.scripts = config.script.map(scr => new Script(scr, this));
	}

	templated(text: string, additional: { [name: string]: unknown }): string {
		const data = { ...this.variables, ...additional };
		console.debug("templating", text, data);
		return Mustache.render(text, data);
	}

	public async handlePost(post: PostView, bot: Bot) {
		const handlers = this.scripts.filter(s => s.target instanceof PostTarget).map(scr => scr.handlePost(post, bot));
		await Promise.all(handlers);
	}

	public async handleComment(comment: CommentView, bot: Bot) {
		const handlers = this.scripts
			.filter(s => s.target instanceof CommentTarget)
			.map(scr => scr.handleComment(comment, bot));

		await Promise.all(handlers);
	}
}
