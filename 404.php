<?php
	include $_SERVER['DOCUMENT_ROOT']."/php/braincatalogue.php";
	
	$uri=$_SERVER['REQUEST_URI'];
	$args=explode("/",$uri);
	
	braincatalogue($args);
?>