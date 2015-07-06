<?php
function returnimages($dirname="../data")
{
	$files = array();
	$curdir=0;
	if($handle = opendir($dirname))
	{
		while(false !== ($file = readdir($handle)))
		{
			/* Do not list hidden files, or directories
			   starting with an underscore "_"
			*/
			if($file{0}!="." and $file{0}!="_")
			{
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