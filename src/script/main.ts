import * as yaml from "js-yaml";
import Mustache from "mustache";
import { Action, CommentTarget, getActionByName, PostTarget, ActionTarget as Target } from "./actions/main.js";
import { Script as ScriptSchema } from "./schema.js";

interface ConfigurationFile {
	variables: { [name: string]: string };
	script: ScriptSchema[];
}

class Script {
	private cfg: Configuration;

	private actions: Action[];
	private target: Target;

	constructor(script: ScriptSchema, cfg: Configuration) {
		this.cfg = cfg;

		if ("new" in script.on && script.on.new == "post") {
			this.target = new PostTarget(script.on);
		} else if ("new" in script.on && script.on.new == "comment") {
			this.target = new CommentTarget(script.on);
		} else {
			throw `Invalid action target`;
		}

		this.actions = [];
		for (const [action, args] of Object.entries(script.actions)) {
			const actionClass = getActionByName(action);

			let actionInit;
			if (args != null) {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				actionInit = new actionClass(args);
			} else {
				actionInit = new actionClass();
			}

			this.actions.push(actionInit);
		}
	}
}

export class Configuration {
	private variables: { [name: string]: string };
	private scripts: Script[];

	constructor(yamlSrc: string) {
		const config = yaml.load(yamlSrc, { schema: yaml.FAILSAFE_SCHEMA }) as ConfigurationFile;

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

	templated(text: string, additional: { [name: string]: string }): string {
		return Mustache.render(text, { ...this.variables, ...additional });
	}
}
