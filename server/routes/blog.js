const config = require("../config");
const {htmlEscape} = require("../util");

const STYLE = `
<style>
.wp-caption-text {
	font-family: Sans-Serif;
}
.aligncenter {
	margin-left:auto;
	margin-right:auto;
}
</style>
`;

const CACHE_MS = 10 * 60 * 1000;
let cache = {html: "", time: 0};

function formatDate(iso) {
	const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short",
		year: "numeric", hour: "numeric", minute: "2-digit", hour12: false
	}).format(d);
}

// Safe to link only to http(s) URLs
function safeUrl(url) {
	return /^https?:\/\//i.test(url) ? htmlEscape(url) : "#";
}

// Posts come from our own WordPress blog, so their content is trusted HTML.
async function fetchBlog() {
	const res = await fetch(config.blogUrl, {signal: AbortSignal.timeout(10000)});
	if (!res.ok)
		throw new Error("Blog responded " + res.status);
	const posts = await res.json();
	return STYLE + posts.map(post => `
<div style="width:600px;margin-left:auto;margin-right:auto;margin-top:2rem">
	<large><strong>${htmlEscape(formatDate(post.date_gmt))}</strong></large>
	<h2 class="blog"><a href="${safeUrl(post.link)}" rel="bookmark" title="Permanent Link to ${htmlEscape(post.title)}">${post.title}</a></h2>
	<div style="background-color:#f8f8f8;padding:1rem">
		${post.content}
	</div>
</div>
`).join("");
}

async function blogHtml() {
	if (Date.now() - cache.time < CACHE_MS)
		return cache.html;
	try {
		cache = {html: await fetchBlog(), time: Date.now()};
	} catch (e) {
		console.error("blog:", e.message);
		if (!cache.html)
			return "<p>The blog is not available right now.</p>";
		cache.time = Date.now() - CACHE_MS + 60000; // serve stale, retry in a minute
	}
	return cache.html;
}

module.exports = {blogHtml};
