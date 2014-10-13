var AtlasMaker=[];	// Globals for AtlasMaker

parseParametres();
loadDependencies();
loadWidget();

function parseParametres()
{
	var els = document.getElementsByTagName('script');
	var re = /.*load-atlasMaker\.js/;
	var foundEls=[];
	for(var i = 0; i < els.length; i++) {
		var el = els[i];
		if(el.src.match(re) && foundEls.indexOf(el) < 0) {
			foundEls.push(el);
			params = el.src.split('?')[1];
			var obj={};
			params.split( '&' ).forEach(function(v,j) {
				var param = v.split( '=' );
				var	key = decodeURIComponent( param[0] );
				var	val = decodeURIComponent( param[1] );
				obj[key] = val;
			});
			AtlasMaker.push(obj);
		}
	}
}
function loadDependencies()
{
	var	dependencies=[	"/lib/atlasMaker/lib/jquery-1.11.0.min.js",
						"/lib/atlasMaker/lib/jquery-ui.js",
						"/lib/atlasMaker/lib/jquery-ui.css",
						"/lib/atlasMaker/lib/jquery.ui.touch-punch.min.js",
						"/lib/atlasMaker/lib/pako/pako.min.js",
						"/lib/atlasMaker/lib/mylogin/login.js"];

	dependencies.forEach(function(v,j) {
		var	s = document.createElement('script');
		s.async=false;
		s.src=v;
		document.body.appendChild(s);
	});
}
function loadWidget()
{
	var	s = document.createElement('script');
	s.async=false;
	s.src="/lib/atlasMaker/atlasMaker.js";
	document.body.appendChild(s);
}