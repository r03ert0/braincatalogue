const path = require("path");

const JS_ESCAPES = {"<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "'": "\\u0027", "\u2028": "\\u2028", "\u2029": "\\u2029"};
const JS_UNSAFE = new RegExp("[<>&'\\u2028\\u2029]", "g");

// Escape a value to place it inside a quoted JS string in a template (either
// quote style), or in plain HTML text. The result contains no HTML-special
// characters, so it cannot break out of a <script> block or an attribute.
function inline(value) {
	return JSON.stringify(String(value)).slice(1, -1).replace(JS_UNSAFE, c => JS_ESCAPES[c]);
}

function htmlEscape(value) {
	return String(value).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}

// Replace every <!--KEY--> placeholder (like str_replace in the PHP version)
function fill(html, values) {
	for (const [key, value] of Object.entries(values))
		html = html.split("<!--" + key + "-->").join(value);
	return html;
}

// A single URL path segment that is safe to use as a file name
function validSegment(s) {
	return typeof s === "string" && s.length > 0 && s.length <= 128 && s[0] !== "." && !/[\/\\\0]/.test(s);
}

// Resolve rel under base, or null if it would escape base
function resolveInside(base, rel) {
	const p = path.resolve(base, rel);
	return p === base || p.startsWith(base + path.sep) ? p : null;
}

module.exports = {inline, htmlEscape, fill, validSegment, resolveInside};
