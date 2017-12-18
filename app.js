var debug = 1;
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mustacheExpress = require('mustache-express');
var fs = require('fs');
const tracer = require('tracer').console({format: '[{{file}}:{{line}}]  {{message}}'});

var dirname = __dirname; // local directory
var serverConfig;

// Check if .example files have been instantiated
// Server-side
if( fs.existsSync(dirname + '/server_config.json') === false ) {
    tracer.error("ERROR: The file server_config.json is not present.");
    tracer.error("Maybe server_config.json.example was not instantiated?");
    process.exit();
}
if( fs.existsSync(dirname + '/github-keys.json') === false ) {
    tracer.error("ERROR: The file github-keys.json is not present.");
    tracer.error("Maybe github-keys.json.example was not instantiated?");
    process.exit();
}

serverConfig = JSON.parse(fs.readFileSync(dirname + '/server_config.json'));

var monk = require('monk');
var MONGO_DB;

var DOCKER_DB = process.env.DB_PORT;
//var DOCKER_DEVELOP = process.env.DEVELOP;
if ( DOCKER_DB ) {
    MONGO_DB = DOCKER_DB.replace( 'tcp', 'mongodb' ) + '/microdraw';
} else {
    MONGO_DB = process.env.MONGODB || 'localhost:27017/microdraw'; //process.env.MONGODB;
}
var db = monk(MONGO_DB);
db.then( function () {
    tracer.log('Connected correctly to mongodb');
});

var index = require('./routes/index');
var specimen = require('./routes/specimen');

var app = express();
app.engine('mustache', mustacheExpress());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'mustache');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
if( debug )
    app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//{ passport github auth
var session = require('express-session');
var passport = require('passport');
var GithubStrategy = require('passport-github').Strategy;
var warningGithubConfig = false;
fs.readFile("github-keys.json", "utf8", (err, githubKeys) => {
    if (err) {
        tracer.warn('github-keys.json does not exist. Users would not be able to be authenticated ...', err);
        warningGithubConfig = true;
    }else{
        try{
            passport.use(new GithubStrategy( JSON.parse(githubKeys),
            (accessToken, refreshToken, profile, done) => done(null, profile)));
        }catch (e) {
            tracer.warn('parsing githubkey.json or passport.use(new GithubStrategy) error', e);
            warningGithubConfig = true;
        }
    }
});
app.use(session({
    secret: "a mi no me gusta la sémola",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
// add custom serialization/deserialization here (get user from mongo?) null is for errors
passport.serializeUser(function (user, done) { done(null, user); });
passport.deserializeUser(function (user, done) { done(null, user); });
// Simple authentication middleware. Add to routes that need to be protected.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}
app.get('/secure-route-example', ensureAuthenticated, function (req, res) { res.send("access granted"); });
app.get('/logout', function (req, res) {
    req.logout();
    res.redirect(req.session.returnTo || '/');
    delete req.session.returnTo;
});
app.get('/loggedIn', function loggedIn(req, res) {
    if (req.isAuthenticated()) {
        res.send({loggedIn: true, username: req.user.username});
    } else {
        res.send({loggedIn: false});
    }
});
// start the GitHub Login process
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback',
    passport.authenticate('github', {failureRedirect: '/'}),
    function (req, res) {
        // successfully loged in. Check if user is new
        db.get('user').findOne({nickname: req.user.username}, "-_id")
            .then(function (json) {
                if (!json) {
                    // insert new user
                    json = {
                        name: req.user.displayName,
                        nickname: req.user.username,
                        url: req.user._json.blog,
                        brainboxURL: "/user/" + req.user.username,
                        avatarURL: req.user._json.avatar_url,
                        joined: (new Date()).toJSON()
                    };
                    db.get('user').insert(json);
                } else {
                    tracer.warn("Update user data from GitHub");
                    db.get('user').update({nickname: req.user.username}, {$set:{
                        name: req.user.displayName,
                        url: req.user._json.blog,
                        avatarURL: req.user._json.avatar_url
                    }});
                }
            });
            res.redirect(req.session.returnTo || '/');
            delete req.session.returnTo;
});
//}

// GUI routes
app.get('/', function (req, res) { // /auth/github
    var login = (req.isAuthenticated()) ?
                ("<a href='/user/" + req.user.username + "'>" + req.user.username + "</a> (<a href='/logout'>Log Out</a>)")
                : ("<a href='/auth/github'>Log in with GitHub</a>");

    // store return path in case of login
    req.session.returnTo = req.originalUrl;

    // get list of available data
    var dirs = fs.readdirSync( dirname + '/public/data/');
    var i, arr = [];
    for (i=0;i<dirs.length;i++) {
        var path = dirname + '/public/data/' + dirs[i] + '/info.txt';
        if(fs.existsSync(path)) {
            var info = JSON.parse(fs.readFileSync( path ));
            
            if( typeof info.display !== 'undefined' && info.display === false ) {
                continue;
            }

            var obj = {
                name: info.name.split('_').join(' '),
                file: dirs[i],
            };
            arr.push(obj);
        }
    }

    // return page
    res.render('index', {
        title: 'BrainCatalogue',
        specimens: JSON.stringify(arr),
        login: login
    });
});
app.use('/', (req, res, next) => {
    var login = (req.isAuthenticated()) ?
                ("<a href='/user/" + req.user.username + "'>" + req.user.username + "</a> (<a href='/logout'>Log Out</a>)")
                : ("<a href='/auth/github'>Log in with GitHub</a>");
    // store return path in case of login
    req.session.returnTo = req.originalUrl;
    req.dirname = __dirname;
    next();
}, specimen);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
