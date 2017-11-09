<?php
$myFile = "ip.txt";
$fh = fopen($myFile, 'a') or die("can't open file");
$stringData = $_POST['userdata'];
fwrite($fh, date("D j M Y,G:i:s,").$stringData."\r");
fclose($fh);
?>