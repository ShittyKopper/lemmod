/* eslint-disable */
import { readdirSync, readFileSync } from "fs";
import yaml from "js-yaml";
import path from "path";
import { validate } from "../out/script/main.js";

for (const file of readdirSync("./examples")) {
	console.info("Checking", file);
	const yml = readFileSync(path.join("./examples", file), { encoding: "utf-8" });
	const scripts = yaml.load(yml, { schema: yaml.FAILSAFE_SCHEMA });

	const fileErrors = [];
	for (const script of scripts) {
		const errors = validate(script);

		if (errors.length > 1) {
			console.info(" - Input  = ", script);
			console.error("   Errors = ", errors);
			fileErrors.concat(errors);
		} else {
			console.info(" + Part valid!");
		}
	}

	if (fileErrors.length > 1) {
		console.error(" - Script has errors.");
	} else {
		console.info(" + Script valid!");
	}
}
