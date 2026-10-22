const path = require("path");

const env = process.env;
const root = path.resolve(__dirname, "..");

module.exports = {
	port: parseInt(env.PORT) || 3000,
	host: env.HOST || "127.0.0.1",
	root,
	dataDir: path.resolve(env.DATA_DIR || path.join(root, "data")),
	db: {
		host: env.DB_HOST || "localhost",
		user: env.DB_USER,
		password: env.DB_PASS,
		database: env.DB_NAME || "braincatalogue"
	},
	loginDb: env.LOGIN_DB || env.DB_NAME || "braincatalogue",
	sessionSecret: env.SESSION_SECRET,
	sendmail: env.SENDMAIL || "/usr/sbin/sendmail"
};
