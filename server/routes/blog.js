const fs = require("fs/promises");
const path = require("path");
const {htmlEscape} = require("../util");

/*
	The blog is static: posts live in server/blog/posts.json, newest first when
	displayed. Each post is {slug, title, date_gmt, content}, where content is
	trusted HTML (written by us, imported from the old WordPress blog).
	Images go in img/blog/. To add a post, add an entry to the file.
*/
const POSTS_FILE = path.join(__dirname, "..", "blog", "posts.json");

const STYLE = `
<style>
.wp-caption-text {
	font-family: Sans-Serif;
}
.aligncenter {
	margin-left:auto;
	margin-right:auto;
}
img.aligncenter {
	display:block;
}
.blog-post img, .blog-post iframe, .blog-post video {
	max-width:100%;
}
.blog-post img {
	height:auto;
}
</style>
`;

function formatDate(iso) {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short",
		year: "numeric", hour: "numeric", minute: "2-digit", hour12: false
	}).format(new Date(iso));
}

async function blogHtml() {
	let posts;
	try {
		posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
	} catch (e) {
		console.error("blog:", e.message);
		return "<p>The blog is not available right now.</p>";
	}
	posts.sort((a, b) => b.date_gmt.localeCompare(a.date_gmt));
	return STYLE + posts.map(post => `
<div class="blog-post" id="${htmlEscape(post.slug)}" style="width:600px;max-width:100%;margin-left:auto;margin-right:auto;margin-top:2rem">
	<large><strong>${htmlEscape(formatDate(post.date_gmt))}</strong></large>
	<h2 class="blog"><a href="#${htmlEscape(post.slug)}">${htmlEscape(post.title)}</a></h2>
	<div style="background-color:#f8f8f8;padding:1rem">
		${post.content}
	</div>
</div>
`).join("");
}

module.exports = {blogHtml};
