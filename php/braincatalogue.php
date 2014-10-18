<?php
error_reporting(E_ALL);
ini_set('display_errors', 'On');

include $_SERVER['DOCUMENT_ROOT']."/php/base.php";
$connection=mysqli_connect($dbhost, $dbuser, $dbpass,"braincatalogue") or die("MySQL Error 1: " . mysql_error());

if(isset($_GET["action"]))
{
	switch($_GET["action"])
	{
		case "updateWiki":
			wikiUpdateAll();
			break;
		case "add_log":
			add_log($_GET);
			break;
	}
}

function braincatalogue($args)
{
	if($args[1]=="blog")
	{
		$html=file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/blog.html");
		$blog=file_get_contents("http://braincatalogue.dev/php/blog.php");
	
		$tmp=str_replace("<!--Core-->",$blog,$html);
		$html=$tmp;
	
		print $html;
	}
	else
	if($args[1]=="atlasMaker")
	{
		$specimen=$args[2];
		if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen))
		{
			header('HTTP/1.1 200 OK');
			header("Status: 200 OK");

			$html = file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/atlasMaker.html");
			$tmp=str_replace("<!--SPECIMEN-->",$specimen,$html);
			$html=$tmp;
			print $html;
		}
		
	}
	else
	{
		$specimen=$args[1];
		if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen))
		{
			header('HTTP/1.1 200 OK');
			header("Status: 200 OK");

			$html = file_get_contents($_SERVER['DOCUMENT_ROOT']."/templates/specimen.html");

			$A="<table style='width:100%;'>";
			if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen."/MRI-n4.nii.gz"))
			{
			// Configure stereotaxic viewer
			//-----------------------------
			$A.=<<<EOF
				<tr>
				<td colspan=3 style='text-align:left'>
					<h1 class="MRI"></h1>
				</td>
				</tr>
				<tr>
					<td>
					<table style="width:512px">
						<tr>
						<td>
							<div id="resizable" style="width:100%">
								<canvas id="brainCanvas" style="width:100%;height:100%"></canvas>
							</div>
						</td>
						</tr>
						<tr>
						<td>
							<div id="slider" style="width:100%;margin:5px 0 10px 0;" oninput="javascript:changeSlice()">
							</div>
							<div id="radio">						
								<input type="radio" id="sagittal" name="radio" checked="checked"><label for="sagittal">Sagittal</label>
								<input type="radio" id="coronal" name="radio"><label for="coronal">Coronal</label>
								<input type="radio" id="axial" name="radio"><label for="axial">Axial</label>
							</div>
						</td>
						</tr>
					</table>
					</td>
				</tr>
EOF;
			}
			if(file_exists($_SERVER['DOCUMENT_ROOT']."/data/".$specimen."/mesh.ply"))
			{
			// Configure mesh view
			//-----------------------------
			$A.=<<<EOF
				<tr><td colspan=3><h1>&nbsp;</h1></td></tr>
				<tr>
				<td colspan=3 style='text-align:left'>
					<h1 class="Mesh"></h1>
				</td>
				</tr>
				<tr>
					<td colspan=3>
						<div style="width:512px;height:512px" id="surface"></div>
					</td>
				</tr>
EOF;
			}
			$A.="</table>";
	
			$tmp=str_replace("<!--DATAVIEW-->",$A,$html);
			$html=$tmp;

			// Configure specimen
			//--------------------
			$tmp=str_replace("<!--SPECIMEN-->",$specimen,$html);
			$html=$tmp;

			print $html;
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
				$q="UPDATE braincatalogue.Log SET Data = \"".mysqli_real_escape_string(json_encode($prevValue))."\" WHERE";
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
				$value=mysqli_real_escape_string("[".$query['value']."]",$connection);
				$q="INSERT INTO braincatalogue.Log (`UserName`, `Type`, `Data`) VALUES (";
				$q.="\"".$query['userName']."\", ";
				$q.="\"".$query['key']."\", ";
				$q.="\"".$value."\")";
				$result = mysqli_query($connection,$q);
				if($result)
					echo "Successfully added user's annotationLength\n";
				else
					echo "ERROR: Unable to add user's annotationLength: ".$q."\n";
			}
		}
	}
}
?>