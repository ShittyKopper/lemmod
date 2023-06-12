function required(variable: string): string {
	const value = process.env[variable];
	if (value == undefined) {
		console.error(`Missing required environment variable $${variable}`);
		process.exit(1);
	}

	return value;
}

export default {
	dataDir: process.env.DATA_DIR || "./data",
	debug: !!process.env.DEBUG,

	user: {
		instance: required("INSTANCE"),
		username: required("USERNAME"),
		password: required("PASSWORD"),
	},

	instances: {
		allowed: process.env.ALLOW_INSTANCES,
		denied: process.env.DENY_INSTANCES,
	},
};
