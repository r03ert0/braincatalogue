const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const config = require("../config");
const {inline, fill, validSegment, resolveInside} = require("../util");
const {blogHtml} = require("./blog");

const router = express.Router();

function template(name) {
	return fs.readFile(path.join(config.root, "templates", name), "utf8");
}

async function isDir(p) {
	try {
		return (await fs.stat(p)).isDirectory();
	} catch (e) {
		return false;
	}
}

async function readInfo(dir) {
	try {
		return JSON.parse(await fs.readFile(path.join(dir, "info.txt"), "utf8"));
	} catch (e) {
		return null;
	}
}

// Specimens shown on the home page: data/<name>/ directories with an info.txt
async function listSpecimens(showAll) {
	const specimens = [];
	for (const entry of (await fs.readdir(config.dataDir)).sort()) {
		if (entry[0] === ".")
			continue;
		const info = await readInfo(path.join(config.dataDir, entry));
		if (!info || (info.display === false && !showAll))
			continue;
		specimens.push({name: entry.replace(/_/g, " "), file: entry});
	}
	return specimens;
}

function notFound(res, what) {
	res.status(404).type("text/plain").send("We don't have data for " + what + ", yet...");
}

router.get("*", async (req, res, next) => {
	try {
		let seg;
		try {
			seg = req.path.split("/").filter(Boolean).map(decodeURIComponent);
		} catch (e) {
			return res.status(400).type("text/plain").send("Bad request");
		}
		if (!seg.every(validSegment))
			return notFound(res, "that");

		const first = seg[0];

		// Home
		if (!first || first === "index.html" || first === "index.htm" || first === "please") {
			const specimens = await listSpecimens(first === "please");
			return res.send(fill(await template("home.html"), {SPECIMENS: inline(JSON.stringify(specimens))}));
		}

		// Blog
		if (first === "blog")
			return res.send(fill(await template("blog.html"), {Core: await blogHtml()}));

		// User page
		if (first === "user") {
			const username = seg[1];
			if (!username || username.length > 64)
				return notFound(res, "that user");
			const s = req.session;
			const own = s && s.loggedIn && s.username === username;
			return res.send(fill(await template("user.html"), {
				HomeUsername: inline(username),
				LoggedIn: s && s.loggedIn ? "1" : "0",
				"E-Mail": own ? inline(s.email || "") : "<!--E-Mail-->"
			}));
		}

		// Atlas editor for a specimen
		if (first === "atlasMaker") {
			if (!seg[1] || !(await isDir(resolveInside(config.dataDir, seg[1]))))
				return notFound(res, seg[1] || "that");
			return res.send(fill(await template("atlasMaker.html"), {SPECIMEN: inline(seg[1])}));
		}

		/*
			Specimen or atlas page. Look from the end of the URL for the
			longest existing data directory. The remainder, if any, is
			the atlas name.
		*/
		for (let i = seg.length; i > 0; i--) {
			const specimen = seg.slice(0, i).join("/");
			const dir = resolveInside(config.dataDir, specimen);
			if (!dir || !(await isDir(dir)))
				continue;

			if (i < seg.length) {
				return res.send(fill(await template("atlasMaker.html"), {
					SPECIMEN: inline(specimen),
					ATLAS: inline(seg[seg.length - 1])
				}));
			}

			const info = await readInfo(dir);
			if (!info)
				return notFound(res, specimen);
			return res.send(fill(await template("specimen.html"), {
				SPECIMEN: inline(specimen),
				INFO: inline(JSON.stringify(info))
			}));
		}
		notFound(res, seg.join("/"));
	} catch (e) {
		next(e);
	}
});

module.exports = router;
