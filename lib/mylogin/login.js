/*
13 Octobre 2014: added check for already logged user
*/

var MyLoginWidget = {
	username:"",
	loggedin:0,
	subscribers:new Array(),
	init: function() {
		var	me=this;
		//$(document.body).append("<div id='login'></div>");
		
		$("div#login").load("/lib/mylogin/login.html");
		
		$.get("/lib/mylogin/login.php",{"action":"check"},function(data){
			try {
				var msg=JSON.parse(data);
			} catch(e) {
				$("div#login").load("/lib/mylogin/login.html",function(){me.displayLoginLink()});
				return;
			}
			
			if(msg.response=="Yes")
			{
				me.username=msg.username;
				me.loggedin=1;
				me.displayLoggedinLink();
			}
			else
			{
				$("div#login").load("/lib/mylogin/login.html",function(){me.displayLoginLink()});
			}
		});
	},
	displayLoginLink: function() {
		$("div#login >").hide();
		$("div#login a#loginLink").show();
	},
	displayLoginForm: function() {
		$("div#login >").hide();
		$("div#login #username").attr("placeholder","Name or E-Mail");
		$("div#login > #username, #password, #sendLogin, #cancel, #registerLink, #remind").show();
	},
	displayLoggedinLink: function() {
		$("div#login >").hide();
		$("div#login span#loggedinLink").show();
		$("div#login a#home").html(this.username);
	},
	displayRegisterForm: function() {
		$("div#login >").hide();
		$("div#login #username").attr("placeholder","Name");
		$("div#login > #username, #e-mail, #password, #repassword, #cancel, #register").show();
	},
	sendLogin: function() {
		var	me=this;
		$.get("/lib/mylogin/login.php",{"action":"login","username":$("#username").val(),"password":$("#password").val()},function(data){
			if(data=="Yes")
			{
				me.username=$("#username").val();
				me.loggedin=1;
				me.displayLoggedinLink();
				$("div#login #warning").html("Successfully logged in").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
				me.subscribers[0](); // inform subscribers of login change
			}
			else
			{
				me.loggedin=0;
				$("div#login #warning").html("Incorrect, try again").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
		});
		$("#password").val("");
	},
	cancel: function() {
		this.displayLoginLink();
	},
	logout: function() {
		var me=this;
		$.get("/lib/mylogin/login.php",{"action":"logout"},function(data){
			if(data=="Yes")
			{
				me.username="";
				me.loggedin=0;
				me.displayLoginLink();
				$("div#login #warning").html("Successfully logged out").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
				me.subscribers[0](); // inform subscribers of login change
			}
			else
			{
				$("div#login #warning").html("Unable to logout, try again later").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
		});
	},
	sendRegister: function () {
		var	me=this;
		var	reg_username=$("div#login #username").val();
		var	reg_email=$("div#login #e-mail").val();
		var	reg_password=$("div#login #password").val();
		var	reg_repassword=$("div#login #repassword").val();

		if(reg_username=="" || reg_email=="" || reg_password=="" || reg_repassword=="")
		{
			$("div#login #warning").html("All fields are required").fadeIn();
			setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			return;
		}

		if(reg_password!=reg_repassword)
		{
			$("div#login #warning").html("Passwords are not the same").fadeIn();
			setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			return;
		}

		$.get("/lib/mylogin/login.php",{"action":"register","username":reg_username,"email":reg_email,"password":reg_password},function(data){
			if(data=="Yes")
			{
				me.username=reg_username;
				me.loggedin=1;
				me.displayLoggedinLink();
				$("div#login #warning").html("Successfully registered").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
			else
			if(data=="Exists")
			{
				$("div#login #warning").html("That username is already in use").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
			else
			{
				$("div#login #warning").html("Sorry, your registration failed. Try again later").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
		});
		$("#password").val("");
		$("#repassword").val("");
	},
	remind: function () {
		var	me=this;
		var	reg_username=$("div#login #username").val();
		
		if(!reg_username && !reg_email)
		{
			$("div#login #warning").html("Provide at least a name or an e-mail").fadeIn();
			setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			return;
		}
		
		$.get("/lib/mylogin/login.php",{"action":"remind","username":reg_username,"email":reg_username},function(data){
			if(data=="Yes")
			{
				$("div#login #warning").html("You should receive shortly a new password by e-mail").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
			else
			if(data=="Unavailable")
			{
				$("div#login #warning").html("No account found with that name or e-mail").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
			else
			{
				$("div#login #warning").html("Unable to send a new password. Please try again later").fadeIn();
				setTimeout(function(){$("div#login #warning").fadeOut()},2000);
			}
		});
	},
	subscribe: function(sub) {
		var me=this;
		me.subscribers.push(sub);
	},
	unsubscribe: function(sub) {
		var me=this;
		me.subscribers.splice(me.subscribers.indexOf(sub),1);
	}
}
MyLoginWidget.init();