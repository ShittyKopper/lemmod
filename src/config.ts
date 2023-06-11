function required(variable: string): string {
	const value = process.env[variable];
	if (value == undefined) {
		console.error(`Missing required environment variable $${variable}`);
		process.exit(1);
	}

	return value;
}

export default {
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
