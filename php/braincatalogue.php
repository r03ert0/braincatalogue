<?php
error_reporting(E_ALL);
ini_set('display_errors', 'On');

include $_SERVER['DOCUMENT_ROOT']."/php/base.php";
$connection=mysqli_connect($dbhost, $dbuser, $dbpass,"braincatalogue") or die("MySQL Error 1: " . mysql_error());

if(isset($_POST["action"]))
{
	switch($_POST["action"])
	{
		case "updateWiki":
			wikiUpdateAll();
			break;
		case "add_log":
			add_log($_POST);
			break;
	}
}

if(isset($_GET["action"]))
{
	switch($_GET["action"])
	{
		case "drawNiiSlice":
			drawNiiSlice($_GET);
			break;
	}
}

function returnimages($dirname="../data")
{
	global $connection;
	$files = array();
	$curdir=0;
	if($handle = opendir($dirname))
	{
		while(false !== ($file = readdir($handle)))
		{	
			if($file{0}!=".") // Do not list hidden files
			{
				if(!file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$file."/info.txt"))
					continue;
			
				$info=json_decode(file_get_contents($_SERVER['DOCUMENT_ROOT']."/data/".$file."/info.txt"));

				if(property_exists($info,'display'))
					if($info->display==false)
						continue;
				$name=str_replace("_"," ",$file);
				$obj["name"]=$name;
				$obj["file"]=$file;
				$files[]=$obj;
			}
		}
	}
	closedir($handle);
	return mysqli_real_escape_string($connection,json_encode($files));
}

function braincatalogue($args)
{
	global $connection;
	
	if(count($args)==0 || $args[1]=="index.html" || $args[1]=="index.htm")
	{
		$html=file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/home.html");
		$specimen=returnimages($_SERVER['DOCUMENT_ROOT']."/data");
		$tmp=str_replace("<!--SPECIMENS-->",$specimen,$html);
		$html=$tmp;

		header('HTTP/1.1 200 OK');
		header("Status: 200 OK");
		print $html;
	}
	else
	if($args[1]=="blog")
	{
		$html=file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/blog.html");
		$blog=file_get_contents("http://braincatalogue.org/php/blog.php");
	
		$tmp=str_replace("<!--Core-->",$blog,$html);
		$html=$tmp;
	
		header('HTTP/1.1 200 OK');
		header("Status: 200 OK");
		print $html;
	}
	else
	if($args[1]=="user")
	{
		user_update($args[2]);
	}
	else
	if($args[1]=="atlasMaker")
	{
		$specimen=$args[2];
		if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen))
		{
			$html = file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/atlasMaker.html");
			$tmp=str_replace("<!--SPECIMEN-->",$specimen,$html);
			$html=$tmp;

			header('HTTP/1.1 200 OK');
			header("Status: 200 OK");
			print $html;
		}
		
	}
	else
	{
		/*
			This bit of code permits to have MRI directories that
			do not appear in the front page.
			It works by looking from the end of the url if the
			directory exists. If it doesn't, it may be because
			the user is asking for a segmentation atlas. In that
			case, the code tries eliminating the last part.
		*/
		$found=false;
		for($i=count($args);$i>0;$i--)
		{
			$specimen=join("/",array_slice($args,0,$i));
			if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen))
			{
				$found=true;
				break;
			}
		}
		
		if($found)
		{
			//var_dump($args);
			//echo "[".$specimen."] ".$found;

			if($i<count($args))
			{
			/*
				Query for atlas
			*/
				$atlas=$args[count($args)];
				if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen."/".$atlas.".nii.gz"))
				{
					header('HTTP/1.1 200 OK');
					header("Status: 200 OK");
			
					$html = file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/atlasMaker.html");
					$tmp=str_replace("<!--SPECIMEN-->",$specimen,$html);
					$html=$tmp;
					$tmp=str_replace("<!--ATLAS-->",$atlas,$html);
					$html=$tmp;
					print $html;
				}
				else
				{
					/*
					header('HTTP/1.1 404 Not Found');
					echo "We don't have an atlas <i>".$atlas."</i> for specimen <i>".$specimen."</i>, yet...";
					*/
					header('HTTP/1.1 200 OK');
					header("Status: 200 OK");
			
					$html = file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/atlasMaker.html");
					$tmp=str_replace("<!--SPECIMEN-->",$specimen,$html);
					$html=$tmp;
					$tmp=str_replace("<!--ATLAS-->",$atlas,$html);
					$html=$tmp;
					print $html;
				}
			}
			else
			{
			/*
				Query for specimen info
			*/
				header('HTTP/1.1 200 OK');
				header("Status: 200 OK");
			
				$html = file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/specimen.html");

				// Configure specimen
				//--------------------
				$tmp=str_replace("<!--SPECIMEN-->",$specimen,$html);
				$html=$tmp;

				// Configure atlases
				//------------------
				$info=json_decode(file_get_contents($_SERVER['DOCUMENT_ROOT']."/data/".$specimen."/info.txt"));
				$tmp=str_replace("<!--INFO-->",mysqli_real_escape_string($connection,json_encode($info)),$html);
				$html=$tmp;

				print $html;
			}
		}
		else
		{
			header('HTTP/1.1 404 Not Found');
			echo "We don't have data for $specimen, yet...";
		}
	}
}
function wikiUpdate($specimen)
/*
	Get the initial paragraphs from the wikipedia page of $specimen
	and save in in the 'description' field of it's corresponding
	info.txt file. Update the 'lastUpdated' field as well.
*/
{
	// Get the wikipedia page
	$ch = curl_init();
	curl_setopt($ch,CURLOPT_URL,"http://en.wikipedia.org/w/api.php");
	curl_setopt($ch,CURLOPT_POST,1);
	curl_setopt($ch,CURLOPT_POSTFIELDS,'action=parse&prop=text&page='.$specimen.'&format=json');
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

	$str="";
	foreach($wiki as $w)
		$str.=$dom->saveXML($w);

	// Get the info.txt file corresponding to the $specimen
	$info=json_decode(file_get_contents($_SERVER['DOCUMENT_ROOT']."/data/".$specimen."/info.txt"));
	
	$info->description->description=$str;
	date_default_timezone_set('Europe/Paris');
	$date=new DateTime();
	$info->description->lastUpdated="last updated: ".$date->format('d F Y');
	
	file_put_contents($_SERVER['DOCUMENT_ROOT']."/data/".$specimen."/info.txt",json_encode($info,JSON_PRETTY_PRINT));
	
	echo "Description updated for ".$specimen."<br>";
}

function wikiUpdateAll()
{
	$files = array();
	$curdir=0;
	if($handle = opendir($_SERVER['DOCUMENT_ROOT']."/data/"))
	{
		while(false !== ($file = readdir($handle)))
		{
			if($file{0}!=".")
			{
				wikiUpdate($file);
				$curdir++;
			}
		}
	}
	closedir($handle);

	return($files);
}
function add_log($query)
{
	global $connection;
	
	switch($query['key'])
	{
		case "annotationLength":
		{
			$value=json_decode($query['value']);
			$length=$value->length;
			
			$q="SELECT Data FROM braincatalogue.Log WHERE";
			$q.="    UserName = \"".$query['userName']."\" AND";
			$q.="        Type = \"".$query['key']."\"";

			$result = mysqli_query($connection,$q);
			if($result and mysqli_num_rows($result)>=1)	// pre-existing value
			{
				$record=mysqli_fetch_assoc($result);
				mysqli_free_result($result);
				$prevValue=json_decode($record["Data"]);
				
				// if there is a previous entry for this specimen and atlas, update it
				$found=false;
				for($i=0;$i<count($prevValue);$i++)
				{
					if($prevValue[$i]->specimen==$value->specimen and $prevValue[$i]->atlas==$value->atlas)
					{
						$prevValue[$i]->length=(float)$prevValue[$i]->length+(float)$value->length;
						$found=true;
						break;
					}
				}
				
				// if there is no previous entry for this speciment and atlas, add it
				if($found==false)
					$prevValue[$i]=$value;

				// update the database
				$q="UPDATE braincatalogue.Log SET Data = \"".mysqli_real_escape_string($connection,json_encode($prevValue))."\" WHERE";
				$q.="    UserName = \"".$query['userName']."\" AND";
				$q.="        Type = \"".$query['key']."\"";
				$result = mysqli_query($connection,$q);
				if($result)
					echo $prevValue[$i]->length;
				else
					echo "ERROR: Unable to update user's annotationLength: ".$q."\n";
	
			}
			else
			{
				$value=mysqli_real_escape_string($connection,"[".$query['value']."]");
				$q="INSERT INTO braincatalogue.Log (`UserName`, `Type`, `Data`) VALUES (";
				$q.="\"".$query['userName']."\", ";
				$q.="\"".$query['key']."\", ";
				$q.="\"".$value."\")";
				$result = mysqli_query($connection,$q);
				if($result)
					echo $value->length;
				else
					echo '{"result":"ERROR: Unable to add annotationLength: '.$q.'"}';
			}
			break;
		}
		case "createAtlas":
		{
			$userName=$query["userName"];
			$key=$query["key"];
			$value=mysqli_real_escape_string($connection,$query["value"]);

			$q="INSERT INTO braincatalogue.Log (`UserName`, `Type`, `Data`) VALUES (";
			$q.="\"".$userName."\", ";
			$q.="\"".$key."\", ";
			$q.="\"".$value."\")";
			$result = mysqli_query($connection,$q);
			if($result)
				echo '{"result":"Success"}';
			else
				echo '{"result":"ERROR: Unable to add createAtlas log: '.$q.'"}';

			break;
		}

	}
}

function user_update($username) {
	global $dbname;
	global $rootdir;

	$html=file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/user.html");
	
	if(isset($_SESSION['Username']))
		$tmp=str_replace("<!--HomeUsername-->",$_SESSION['Username'],$html);
	else
		$tmp=str_replace("<!--HomeUsername-->","",$html);
	$html=$tmp;

	if(isset($_SESSION['LoggedIn']))
		$tmp=str_replace("<!--LoggedIn-->",$_SESSION['LoggedIn'],$html);
	else
		$tmp=str_replace("<!--LoggedIn-->","0",$html);
	$html=$tmp;
	
	
	// public data
	$tmp=str_replace("<!--HomeUsername-->",$username,$html);
	$html=$tmp;

	// private data
	if(isset($_SESSION['Username']) && $_SESSION['Username']==$username)
	{
		$tmp=str_replace("<!--E-Mail-->",$_SESSION['EmailAddress'],$html);
		$html=$tmp;
	}
	
	print $html;
}

function drawNiiSlice($args) {
	header('Content-Type: image/jpeg');
	passthru("/usr/local/bin/node ../js/drawNiiSlice.js "
		."../".$args["nii-file"]." "
		.$args["view"]." "
		.$args["slice-index"],$err);
}
?>
