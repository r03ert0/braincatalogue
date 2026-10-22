# BrainCatalogue server

Express replacement for `php/` (`braincatalogue.php`, `blog.php`, `ip.php`, `lib/mylogin/login.php`).
It serves the same URLs, templates and static files, so the front end is unchanged.

Requires Node >= 18 (global `fetch`). Node 16 on the VM is end of life: `sudo dnf module install nodejs:20`.

## Run

    cd server
    npm install --omit=dev
    cp .env.example .env     # fill in the DB values from php/base.php and a SESSION_SECRET
    node --env-file=.env server.js        # Node >= 20.6; otherwise export the variables

It listens on 127.0.0.1:3000. Put Apache in front and proxy everything to it, except the
AtlasMaker WebSocket server which keeps its own port:

    ProxyPass        / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

A systemd unit with `EnvironmentFile=/var/www/html/braincatalogue/server/.env`, `User=apache`
and `ExecStart=/usr/bin/node server.js` keeps it running.

## Differences from the PHP app

- **Removed** `?action=drawNiiSlice` (unused: only referenced in a commented-out block of `atlasMaker.js`),
  `?action=updateInfo` and `action=updateWiki` (unauthenticated, shell-injectable) and `ip.php`.
  Regenerate `info.txt` with `node scripts/wiki-update.js <specimen>` instead.
- `add_log` now needs a logged-in session and logs under the session's username, not a client-supplied one.
  All SQL is parameterised.
- Only `css/ img/ lib/ data/`, three files in `js/`, two in `templates/` (the toolbar and surface viewer that `atlasMaker.js` fetches), `about.html`, `contact.html` and `feed.xml` are served.
  `.php`, `.git`, `js/db_url.txt`, `templates/` etc. are not reachable.
- `login.php` keeps the same query-string interface and the existing md5 password hashes, so current
  accounts work. Passwords still travel in the URL (that is how `login.js` sends them) and md5 is weak:
  moving to bcrypt/scrypt needs a wider `Password` column and a `login.js` change.
  The e-mail update, which never worked in PHP (`EmailAdress` typo), now does.
- Password reminders use `sendmail` (see `SENDMAIL`). The VM has none installed, so reminders answer "Fail"
  until a mail transport is set up (the PHP `mail()` had the same problem there).
- The blog is static: the six `braincatalogue` posts of the old WordPress blog (siphonophore.org, which no longer resolves) are in `server/blog/posts.json`, with their images in `img/blog/`. `/feed.xml` is an RSS feed generated from the same file (served as `text/xml` with the `server/blog/feed.xsl` stylesheet so browsers show a readable page instead of downloading it) (both RSS icons point to it; set `SITE_URL` if the public address changes). To add a post, add an entry (`slug`, `title`, `date_gmt`, HTML `content`) to that file and restart.
- Sessions are in memory: users are logged out when the process restarts.
- User and specimen names from URLs are escaped before going into templates.

## Services

Both processes run under systemd; copies of the unit files are in `deploy/`.

- `braincatalogue.service`: this Express server, on `127.0.0.1:3000`, configured by `/etc/braincatalogue.env`.
- `braincatalogue-ws.service`: the AtlasMaker WebSocket server (`js/atlasMakerServer.js`). It listens on `WS_PORT` (default 8080; 9090 in production, where Apache serves `wss://braincatalogue.org:8080` over TLS and proxies to it). The client picks `wss` when the page is loaded over https, so no code edits are needed per environment.

After a deploy: `sudo -u naat git pull`, then `sudo systemctl restart braincatalogue braincatalogue-ws`.
