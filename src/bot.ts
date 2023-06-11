import { LemmyHttp } from "lemmy-js-client";

export default class Bot {
	private lemmy: LemmyHttp;
	private jwt: string;

	constructor(lemmy: LemmyHttp, jwt: string) {
		this.lemmy = lemmy;
		this.jwt = jwt;
	}
}
