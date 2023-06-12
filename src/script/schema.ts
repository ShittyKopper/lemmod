export type Text = string | { regex: { match: string; save_groups?: string[] } };
export type Url = Text | { hash?: Text; domain?: Text; path?: Text; query?: Text };

export type Script = ScriptPost | ScriptComment;
type ScriptPost = { on: OnPost; actions: Actions & PostActions };
type ScriptComment = { on: OnComment; actions: Actions }; // CommentActions do not exist

export type OnPost = {
	new?: "post";
	title?: Text;
	body?: Text;
	nsfw?: boolean;
	embed?: { title?: Text; description?: Text };
	url?: Url;
	creator?: Creator;
};

export type OnComment = { new?: "comment"; body?: Text; creator?: Creator };

interface Creator {
	admin?: boolean;
	bot?: boolean;
	local?: boolean;
	name?: Text;
	display_name?: Text;
}

interface Actions {
	delete: string;
	ban: string;
	message: string;
	report: string;
	reply: string;
}

interface PostActions {
	pin: null;
	lock: null;
	rename: string;
}
