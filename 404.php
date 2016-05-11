<?php
	include $_SERVER['DOCUMENT_ROOT']."/php/braincatalogue.php";
	
	$uri=$_SERVER['REQUEST_URI'];
	$args=array_filter(explode("/",$uri));
	braincatalogue(array_filter(explode("/",parse_url($uri,PHP_URL_PATH))));
?>