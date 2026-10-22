const crypto = require("crypto");
const {spawn} = require("child_process");
const express = require("express");
const config = require("../config");
const db = require("../db");

const router = express.Router();

/*
	Existing accounts store md5(mysqli_real_escape_string(password)), so the
	hash must be computed over the escaped password to keep them working.
*/
function legacyHash(password) {
	const escaped = password.replace(/[\0\n\r\\'"\x1a]/g, c => ({"\0": "\\0", "\n": "\\n", "\r": "\\r", "\x1a": "\\Z"}[c] || "\\" + c));
	return crypto.createHash("md5").update(escaped).digest("hex");
}

function sameHash(a, b) {
	a = Buffer.from(String(a));
	b = Buffer.from(String(b));
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Allow 20 attempts per client every 10 minutes
const attempts = new Map();
function tooMany(req) {
	const now = Date.now();
	for (const [ip, a] of attempts)
		if (a.reset < now)
			attempts.delete(ip);
	const a = attempts.get(req.ip) || {count: 0, reset: now + 10 * 60 * 1000};
	attempts.set(req.ip, a);
	return ++a.count > 20;
}

function str(v, max = 256) {
	return typeof v === "string" && v.length <= max ? v : "";
}

// login.js reads every answer as text (and JSON.parses some), like the PHP version
function send(res, body) {
	res.type("html").send(typeof body === "string" ? body : JSON.stringify(body));
}

function setSession(req, row) {
	req.session.username = row.Username;
	req.session.email = row.EmailAddress;
	req.session.loggedIn = 1;
}

function regenerate(req) {
	return new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
}

function sendMail(to, subject, text) {
	return new Promise(resolve => {
		if (/[\r\n]/.test(to))
			return resolve(false);
		const p = spawn(config.sendmail, ["-t", "-i"], {stdio: ["pipe", "ignore", "ignore"]});
		p.on("error", () => resolve(false));
		p.on("close", code => resolve(code === 0));
		p.stdin.on("error", () => {});
		p.stdin.end(`To: ${to}\nFrom: braincatalogue.org <no-reply@braincatalogue.org>\nSubject: ${subject}\n\n${text}\n`);
	});
}

function newPassword() {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
	let p = "";
	for (let i = 0; i < 16; i++)
		p += chars[crypto.randomInt(chars.length)];
	return p;
}

const actions = {
	check(req, res) {
		if (req.session.loggedIn)
			send(res, {response: "Yes", username: req.session.username});
		else
			send(res, {response: "No"});
	},

	async login(req, res) {
		const username = str(req.query.username, 64), password = str(req.query.password);
		const [rows] = await db.query(`SELECT Username, EmailAddress, Password FROM ${db.usersTable} WHERE Username = ?`, [username]);
		if (rows.length !== 1 || !sameHash(rows[0].Password, legacyHash(password)))
			return send(res, "No");
		await regenerate(req);
		setSession(req, rows[0]);
		send(res, "Yes");
	},

	async register(req, res) {
		const username = str(req.query.username, 64), password = str(req.query.password);
		const email = str(req.query.email, 128);
		if (!username || !password || !/^[^@\s]+@[^@\s]+$/.test(email))
			return send(res, "Fail");
		const [existing] = await db.query(`SELECT 1 FROM ${db.usersTable} WHERE Username = ?`, [username]);
		if (existing.length)
			return send(res, "Exists");
		await db.query(`INSERT INTO ${db.usersTable} (Username, Password, EmailAddress) VALUES (?, ?, ?)`,
			[username, legacyHash(password), email]);
		await regenerate(req);
		setSession(req, {Username: username, EmailAddress: email});
		send(res, "Yes");
	},

	async update(req, res) {
		if (!req.session.loggedIn)
			return send(res, {success: "No", message: "Not logged in"});
		const username = req.session.username;
		const password = str(req.query.password), email = str(req.query.email, 128);
		const newPassword = str(req.query.newpassword);

		const [rows] = await db.query(`SELECT Password FROM ${db.usersTable} WHERE Username = ?`, [username]);
		if (rows.length !== 1 || !sameHash(rows[0].Password, legacyHash(password)))
			return send(res, {success: "No", message: "Incorrect password"});

		let message = "";
		if (newPassword.length >= 8) {
			await db.query(`UPDATE ${db.usersTable} SET Password = ? WHERE Username = ?`, [legacyHash(newPassword), username]);
			message += "Password updated. ";
		}
		if (/^[^@\s]+@[^@\s]+$/.test(email) && email !== req.session.email) {
			await db.query(`UPDATE ${db.usersTable} SET EmailAddress = ? WHERE Username = ?`, [email, username]);
			req.session.email = email;
			message += "E-Mail address updated";
		}
		send(res, {success: "Yes", message: message || "No change"});
	},

	// Replace the password by a random one and mail it
	async remind(req, res) {
		const query = str(req.query["email+name"], 128);
		if (!query)
			return send(res, "Unavailable");
		let [rows] = await db.query(`SELECT Username, EmailAddress FROM ${db.usersTable} WHERE EmailAddress = ?`, [query]);
		if (!rows.length)
			[rows] = await db.query(`SELECT Username, EmailAddress FROM ${db.usersTable} WHERE Username = ?`, [query]);
		if (!rows.length)
			return send(res, "Unavailable");

		const {Username, EmailAddress} = rows[0];
		const password = newPassword();
		// send first, so that a failure to mail does not lock the user out
		if (!await sendMail(EmailAddress, "Password Reset for Brain Catalogue", `Dear ${Username}, your new password is: ${password}`))
			return send(res, "Fail");
		await db.query(`UPDATE ${db.usersTable} SET Password = ? WHERE Username = ? AND EmailAddress = ?`,
			[legacyHash(password), Username, EmailAddress]);
		send(res, "Yes");
	},

	logout(req, res) {
		req.session.destroy(() => send(res, "Yes"));
	}
};

// Same URL and query-string interface as lib/mylogin/login.php, which login.js uses
router.get("/lib/mylogin/login.php", async (req, res) => {
	const action = Object.prototype.hasOwnProperty.call(actions, req.query.action) ? req.query.action : null;
	if (!action)
		return res.status(400).type("text/plain").send("Unknown action");
	if (["login", "register", "remind"].includes(action) && tooMany(req))
		return send(res, action === "register" ? "Fail" : "No");
	try {
		await actions[action](req, res);
	} catch (e) {
		console.error("login " + action + ":", e);
		if (!res.headersSent)
			send(res, "Fail");
	}
});

module.exports = router;
