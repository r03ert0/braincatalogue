const path = require("path");
const express = require("express");
const session = require("express-session");
const config = require("./config");

if (!config.sessionSecret) {
	console.error("SESSION_SECRET is not set (see .env.example)");
	process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // behind Apache

app.use((req, res, next) => {
	res.set("X-Content-Type-Options", "nosniff");
	next();
});

app.use(session({
	secret: config.sessionSecret,
	resave: false,
	saveUninitialized: false,
	cookie: {httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 7 * 24 * 3600 * 1000}
}));

// Dynamic endpoints that keep their old PHP URLs
app.use(require("./routes/log"));
app.use(require("./routes/login"));

// Never serve PHP source
app.use((req, res, next) => /\.php$/i.test(req.path) ? res.status(404).type("text/plain").send("Not found") : next());

// Static files: only what the site uses (the repo also holds server-side code and secrets)
const root = config.root;
const opts = {dotfiles: "ignore", index: false};
for (const dir of ["css", "img", "lib"])
	app.use("/" + dir, express.static(path.join(root, dir), opts));
app.use("/data", express.static(config.dataDir, opts));
for (const file of ["atlasMaker.js", "myMesh.js", "surfacenets-worker.js"])
	app.get("/js/" + file, (req, res) => res.sendFile(path.join(root, "js", file)));
// Fetched by atlasMaker.js (toolbar HTML, and the surface viewer opened from it)
for (const file of ["atlasMakerTools.html", "surface.html"])
	app.get("/templates/" + file, (req, res) => res.sendFile(path.join(root, "templates", file)));
for (const file of ["about.html", "contact.html"])
	app.get("/" + file, (req, res, next) => res.sendFile(path.join(root, file), e => e && next()));

// RSS feed, generated from the blog posts
app.get("/feed.xml", async (req, res, next) => {
	try {
		res.type("application/rss+xml").send(await require("./routes/blog").feedXml(config.siteUrl));
	} catch (e) {
		next(e);
	}
});

// Pages
app.use(require("./routes/pages"));

app.use((err, req, res, next) => {
	console.error(req.method, req.url, err);
	if (!res.headersSent)
		res.status(500).type("text/plain").send("Something went wrong.");
});

app.listen(config.port, config.host, () =>
	console.log(`BrainCatalogue listening on http://${config.host}:${config.port}`));
