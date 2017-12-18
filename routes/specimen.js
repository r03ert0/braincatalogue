var fs = require('fs');
var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/:specimen', function(req, res, next) {
    var login = (req.isAuthenticated()) ?
                ("<a href='/user/" + req.user.username + "'>" + req.user.username + "</a> (<a href='/logout'>Log Out</a>)")
                : ("<a href='/auth/github'>Log in with GitHub</a>");
    req.session.returnTo = req.originalUrl;
    var {dirname} = req;
    var {specimen} = req.params;
    var path = dirname + '/public/data/' + specimen + '/info.txt';
    if( !fs.existsSync(path) ) {
        res.status(404);
    } else {
        var info = JSON.parse(fs.readFileSync( path ));
        res.render('specimen', {
            specimen: specimen,
            login: login,
            info: JSON.stringify(info)
        });
    }
});

module.exports = router;
