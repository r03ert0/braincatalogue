<?php

// Usage: php wiki.php Human
// Get the initial paragraphs from the wikipedia page of $argv[1] (Human, in the example)

// Get the wikipedia page
$ch = curl_init();
curl_setopt($ch,CURLOPT_URL,"http://en.wikipedia.org/w/api.php");
curl_setopt($ch,CURLOPT_POST,1);
curl_setopt($ch,CURLOPT_POSTFIELDS,'action=parse&prop=text&page='.$argv[1].'&format=json');
curl_setopt($ch,CURLOPT_RETURNTRANSFER,1);
$output=curl_exec($ch);
curl_close($ch);

// Parse the json file and get the html code
$o=json_decode($output);
$html=$o->parse->text->{'*'};
$dom = new domDocument;
$dom->loadHTML($html);
$ps = $dom->getElementsByTagName('p');

// Extract the initial text (at least 700 characters)
$wiki=array();
$strlen=0;
$i=1;
do
{
	$x=$ps->item($i);

	// delete links, sups and spans
	$delist=array();
	$links=$x->getElementsByTagName('a');
	foreach($links as $link)
	{
		$txt=new domText($link->nodeValue);
		$link->parentNode->insertBefore($txt,$link);
		$delist[]=$link;
	}
	$links=$x->getElementsByTagName('sup');
	foreach($links as $link)
		$delist[]=$link;
	$links=$x->getElementsByTagName('span');
	foreach($links as $link)
		$delist[]=$link;
	foreach($delist as $del)
		$del->parentNode->removeChild($del);

	if(strlen($x->nodeValue))
	{
		$wiki[]=$x;
		$strlen+=strlen($x->nodeValue);
	}
	$i++;
}
while($strlen<700);

foreach($wiki as $w)
	echo $dom->saveXML($w)."\n";
echo $i."\n";

//file_put_contents('/Users/roberto/Desktop/humanp.txt',$ps->item(1)->nodeValue);
?>