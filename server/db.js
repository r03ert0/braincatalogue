const mysql = require("mysql2/promise");
const config = require("./config");

// Table names are interpolated into SQL, so they must be plain identifiers.
for (const name of [config.db.database, config.loginDb])
	if (!/^\w+$/.test(name))
		throw new Error("Invalid database name: " + name);

// Created lazily so that the pages work without a database.
let pool;
function getPool() {
	if (!pool)
		pool = mysql.createPool({...config.db, connectionLimit: 5});
	return pool;
}

module.exports = {
	query: (sql, params) => getPool().query(sql, params),
	logTable: "`" + config.db.database + "`.`Log`",
	usersTable: "`" + config.loginDb + "`.`Users`"
};
