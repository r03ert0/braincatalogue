<?php
error_reporting(E_ALL);
ini_set('display_errors', 'On');

function returnimages($dirname="../data")
{
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
	echo json_encode($files);
}

returnimages();

?>