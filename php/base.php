<?php
session_start();
$dbhost = "localhost"; // this will ususally be 'localhost', but can sometimes differ
$dbuser = "root"; // the username that you created, or were given, to access your database
$dbpass = "beo8hkii"; // the password that you created, or were given, to access your database
mysql_connect($dbhost, $dbuser, $dbpass) or die("MySQL Error 1: " . mysql_error());
?>