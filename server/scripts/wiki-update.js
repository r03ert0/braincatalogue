#!/usr/bin/env node
/*
	Build the info.txt content of a specimen from its Wikipedia page and the
	dimensions of its MRI volume. Replaces the updateInfo action of the PHP
	app, which ran unauthenticated from the web. Prints JSON to stdout:

		node scripts/wiki-update.js Human > ../data/Human/info.txt

	Pass several names to print an array. Review the output before saving.
*/
const fs = require("fs");
const path = require("path");
const {execFile} = require("child_process");
const {promisify} = require("util");
const cheerio = require("cheerio");
const config = require("../config");
const {validSegment, resolveInside} = require("../util");

const run = promisify(execFile);

// First paragraphs of the Wikipedia article, at least 2000 characters of text
async function wikiText(specimen) {
	const res = await fetch("https://en.wikipedia.org/w/api.php", {
		method: "POST",
		headers: {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "braincatalogue.org/1.0"},
		body: new URLSearchParams({
			action: "parse", prop: "text", page: specimen, format: "json", redirects: "1",
			disablelimitreport: "", disabletoc: "", disableeditsection: ""
		}),
		signal: AbortSignal.timeout(20000)
	});
	const json = await res.json();
	if (!json.parse)
		throw new Error("No Wikipedia page for " + specimen);
	const $ = cheerio.load(json.parse.text["*"]);

	let html = "", length = 0;
	$("p").each((i, p) => {
		if (length >= 2000)
			return false;
		const $p = $(p);
		$p.find("a").each((j, a) => $(a).replaceWith($(a).text()));
		$p.find("sup, span").remove();
		const text = $p.text();
		if (text.length) {
			html += $.html($p);
			length += text.length;
		}
	});
	return {
		html,
		binomial: $("span.binomial i").first().text(),
	};
}

// Dimensions and voxel size from `volume -info`
async function volumeInfo(specimen) {
	const dir = resolveInside(config.dataDir, specimen);
	const volname = fs.readdirSync(dir).filter(f => /^MRI.*\.nii\.gz$/.test(f)).sort()[0];
	if (!volname)
		throw new Error("No MRI*.nii.gz in " + dir);
	const {stdout} = await run(path.join(config.root, "bin", "volume"), ["-i", path.join(dir, volname), "-info"]);
	const numbers = re => (stdout.split("\n").find(l => re.test(l)) || "").trim().split(/\s+/).slice(1, 4).map(Number);
	return {volname, dim: numbers(/dim:/), pixdim: numbers(/voxelSize:/)};
}

async function makeInfo(specimen) {
	if (!validSegment(specimen))
		throw new Error("Invalid specimen name: " + specimen);
	const wiki = await wikiText(specimen);
	const vol = await volumeInfo(specimen);
	const date = new Date().toLocaleDateString("en-GB", {day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris"});
	return {
		description: {
			description: wiki.html + '<a href="https://en.wikipedia.org/wiki/' + encodeURIComponent(specimen) + '">More on Wikipedia</a>',
			acknowledgements: "",
			commonName: specimen,
			lastUpdated: "last updated: " + date,
			scientificName: wiki.binomial
		},
		url: "/data/" + specimen + "/",
		mesh: "mesh.ply",
		mri: {
			atlas: [{name: "Telencephalon", description: "Telencephalon", filename: "Telencephalon.nii.gz"}],
			brain: vol.volname,
			dim: vol.dim,
			pixdim: vol.pixdim
		},
		name: specimen,
		picture: {file: "picture.jpg", width: 200, height: 200, name: specimen + " (" + wiki.binomial + ")"}
	};
}

(async () => {
	const names = process.argv.slice(2);
	if (!names.length) {
		console.error("usage: wiki-update.js <specimen> [...]");
		process.exit(2);
	}
	const infos = [];
	for (const name of names)
		infos.push(await makeInfo(name));
	console.log(JSON.stringify(infos.length === 1 ? infos[0] : infos, null, 2));
})().catch(e => {
	console.error(e.message);
	process.exit(1);
});
