import { LRUCache } from "lru-cache";
import RE2 from "re2";
import { Configuration } from "./main.js";
import type { Text } from "./schema.js";

const REGEX_CACHE: LRUCache<string, RE2, unknown> = new LRUCache({ max: 200 });

export function templateizeText(cfg: Configuration, text: Text, struct: { [name: string]: unknown }) {
	if (typeof text == "string") {
		text = cfg.templated(text, struct);
	} else {
		text.regex.match = cfg.templated(text.regex.match, struct);
	}

	return text;
}

export function matchText(a: Text, b: Text): [boolean, { [regexGroupName: string]: string }] {
	const reGroups: { [key: string]: string } = {};

	if (typeof a == "string" && typeof b == "string") {
		return [a == b, {}];
	}

	if (typeof a != "string" && "regex" in a && typeof b == "string") {
		let regex = REGEX_CACHE.get(a.regex.match);
		if (!regex) {
			regex = new RE2(a.regex.match);
			REGEX_CACHE.set(a.regex.match, regex);
		}

		const results = regex.exec(b);
		if (results == null) {
			return [false, {}];
		}

		if (a.regex.save_groups != undefined && results.groups != undefined) {
			const groups = Object.keys(results.groups);
			const groupSaved = groups.filter(k => a.regex.save_groups?.includes(k));
			for (const k of groupSaved) {
				reGroups[k] = results.groups[k];
			}
		}
	}

	if (typeof b != "string" && "regex" in b && typeof a == "string") {
		return matchText(b, a); // fuck you
	}

	return [true, reGroups];
}
