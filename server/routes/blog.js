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

async function loadPosts() {
	const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
	return posts.sort((a, b) => b.date_gmt.localeCompare(a.date_gmt));
}

async function blogHtml() {
	let posts;
	try {
		posts = await loadPosts();
	} catch (e) {
		console.error("blog:", e.message);
		return "<p>The blog is not available right now.</p>";
	}
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

function xmlEscape(value) {
	return String(value).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"}[c]));
}

// Feed readers show content out of context, so links and images must be absolute
function absolutize(html, siteUrl) {
	return html
		.replace(/(href|src|poster)="\/\//g, '$1="https://')
		.replace(/(href|src|poster)="\//g, '$1="' + siteUrl + "/");
}

// RSS 2.0 feed of the blog
async function feedXml(siteUrl) {
	const posts = await loadPosts();
	const items = posts.map(post => {
		const link = siteUrl + "/blog#" + encodeURIComponent(post.slug);
		const content = absolutize(post.content, siteUrl).replace(/\]\]>/g, "]]]]><![CDATA[>");
		return `
<item>
	<title>${xmlEscape(post.title)}</title>
	<link>${xmlEscape(link)}</link>
	<guid isPermaLink="true">${xmlEscape(link)}</guid>
	<pubDate>${new Date(post.date_gmt).toUTCString()}</pubDate>
	<category>BrainCatalogue</category>
	<description><![CDATA[${content}]]></description>
</item>`;
	}).join("\n");
	const updated = posts.length ? new Date(posts[0].date_gmt).toUTCString() : new Date().toUTCString();

	return `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Brain Catalogue</title>
<link>${xmlEscape(siteUrl)}/blog</link>
<description>News from the Brain Catalogue, a citizen-science portal for comparative brain anatomy.</description>
<language>en</language>
<lastBuildDate>${updated}</lastBuildDate>
<atom:link href="${xmlEscape(siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`;
}

module.exports = {blogHtml, feedXml};
