const express = require("express");
const db = require("../db");

const router = express.Router();

function parseValue(text) {
	try {
		const v = JSON.parse(text);
		return v && typeof v === "object" ? v : null;
	} catch (e) {
		return null;
	}
}

/*
	Annotation statistics. The client posts to the old PHP URL, so keep it.
		action=add_log, key=annotationLength|createAtlas, value=<string>
*/
router.post("/php/braincatalogue.php", express.urlencoded({extended: false, limit: "20kb"}), async (req, res) => {
	const {action, key, value} = req.body;
	if (action !== "add_log")
		return res.status(400).type("text/plain").send("ERROR: Unsupported action");
	if (!req.session.loggedIn)
		return res.status(401).type("text/plain").send("ERROR: Not logged in");
	if (typeof value !== "string")
		return res.status(400).type("text/plain").send("ERROR: Missing value");

	const userName = req.session.username;
	try {
		switch (key) {
			case "annotationLength": {
				const entry = parseValue(value);
				if (!entry)
					return res.status(400).type("text/plain").send("ERROR: Invalid value");
				entry.length = Number(entry.length) || 0;

				const [rows] = await db.query(
					`SELECT Data FROM ${db.logTable} WHERE UserName = ? AND Type = ?`, [userName, key]);

				if (rows.length) {
					let data;
					try {
						data = JSON.parse(rows[0].Data);
					} catch (e) {
						data = [];
					}
					if (!Array.isArray(data))
						data = [];
					// add to the existing entry for this specimen and atlas, or append a new one
					let found = data.find(d => d.specimen === entry.specimen && d.atlas === entry.atlas);
					if (found)
						found.length = (Number(found.length) || 0) + entry.length;
					else
						data.push(found = entry);
					await db.query(
						`UPDATE ${db.logTable} SET Data = ? WHERE UserName = ? AND Type = ?`,
						[JSON.stringify(data), userName, key]);
					return res.type("text/plain").send(String(found.length));
				}

				await db.query(
					`INSERT INTO ${db.logTable} (UserName, Type, Data) VALUES (?, ?, ?)`,
					[userName, key, JSON.stringify([entry])]);
				return res.type("text/plain").send(String(entry.length));
			}
			case "createAtlas":
				await db.query(
					`INSERT INTO ${db.logTable} (UserName, Type, Data) VALUES (?, ?, ?)`,
					[userName, key, value]);
				return res.json({result: "Success"});
			default:
				return res.status(400).type("text/plain").send("ERROR: Unknown key");
		}
	} catch (e) {
		console.error("add_log:", e);
		res.status(500).type("text/plain").send("ERROR: Unable to log");
	}
});

module.exports = router;
