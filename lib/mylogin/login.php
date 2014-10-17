<?php

/*
13 Octobre 2014: add user_check()
*/

error_reporting(E_ALL);
ini_set('display_errors', 'On');

$rootdir = "/";

include $_SERVER['DOCUMENT_ROOT'].$rootdir."/php/base.php";
mysql_select_db("Users") or die("MySQL Error 2: " . mysql_error());

if(isset($_GET["action"]))
{
	switch($_GET["action"])
	{
		case "check":
			user_check();
			break;
		case "login":
			user_login();
			break;
		case "register":
			user_register();
			break;
		case "remind":
			user_remind();
			break;
		case "logout":
			user_logout();
			break;
	}
}
function user_check()
{
    if($_SESSION['LoggedIn']==1)
        echo '{"response":"Yes", "username":"'.$_SESSION['Username'].'"}';
    else
	    echo "{response:No}";
}
function user_login()
{
    $username = mysql_real_escape_string($_GET['username']);
    $password = md5(mysql_real_escape_string($_GET['password']));
    
    $checklogin = mysql_query("SELECT * FROM Users.Users WHERE Username = '".$username."' AND Password = '".$password."'");
    if(mysql_num_rows($checklogin) == 1)
    {
        $row = mysql_fetch_array($checklogin);
        $email = $row['EmailAddress'];
        $_SESSION['Username'] = $username;
        $_SESSION['EmailAddress'] = $email;
        $_SESSION['LoggedIn'] = 1;
        echo "Yes";
    }
    else
	    echo "No";
}
function user_register()
{
	$username = mysql_real_escape_string($_GET['username']);
	$password = md5(mysql_real_escape_string($_GET['password']));
	$email = mysql_real_escape_string($_GET['email']);

	 $checkusername = mysql_query("SELECT * FROM Users.Users WHERE Username = '".$username."'");
	 if(mysql_num_rows($checkusername) == 1)
		echo "Exists";
	 else
	 {
		$registerquery = mysql_query("INSERT INTO Users.Users (Username, Password, EmailAddress) VALUES('".$username."', '".$password."', '".$email."')");
		if($registerquery)
		{
			$checklogin = mysql_query("SELECT * FROM Users.Users WHERE Username = '".$username."' AND Password = '".$password."'");
			if(mysql_num_rows($checklogin) == 1)
			{
				$row = mysql_fetch_array($checklogin);
				$email = $row['EmailAddress'];
				$_SESSION['Username'] = $username;
				$_SESSION['EmailAddress'] = $email;
				$_SESSION['LoggedIn'] = 1;
				echo "Yes";
			}
		}
		else
			echo "Fail";
	 }
}
function user_remind()
{
	$flagFound=0;
	
	$email = mysql_real_escape_string($_GET['email+name']);
	$checklogin = mysql_query("SELECT * FROM Users.Users WHERE EmailAddress = '".$email."'");
	if(mysql_num_rows($checklogin)==0)
	{
		$username = mysql_real_escape_string($_GET['email+name']);
		$checklogin = mysql_query("SELECT * FROM Users.Users WHERE Username = '".$username."'");
	}

	if(mysql_num_rows($checklogin)>0)
	{
		$row = mysql_fetch_array($checklogin);
		$username = $row['Username'];
		$email = $row['EmailAddress'];
		
		// Generate password
		$length=16;
		$password="";
		$chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
		$count = mb_strlen($chars);
		for ($i = 0, $result = ''; $i < $length; $i++) {
			$index = rand(0, $count - 1);
			$password .= mb_substr($chars, $index, 1);
		}
	
		$message = "Dear ".$username.", your new password is: ".$password;
		mail($email, 'BrainSpell password', $message);

		$username = mysql_real_escape_string($username);
		$password = md5(mysql_real_escape_string($password));
		$email = mysql_real_escape_string($email);
		$registerquery=mysql_query("UPDATE Users.Users SET Password = '".$password."' WHERE Username = '".$username."' AND EmailAddress = '".$email."'");
		if($registerquery)
			echo "Yes";
		else
			echo "Fail";
	}
	else
	{
		echo "Unavailable";
	}
}
function user_logout()
{
	$_SESSION = array();
	session_destroy();
	echo "Yes";
}
?>
