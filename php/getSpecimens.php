<?php
function returnimages($dirname="../data")
{
	$files = array();
	$curdir=0;
	if($handle = opendir($dirname))
	{
		while(false !== ($file = readdir($handle)))
		{
			if($file{0}!=".")
			{
				$name=str_replace("_"," ",$file);
				echo '<div class="square">';
				echo '<a class="gallery" alt="'.$name.'"';
				//echo ' title="'.$name.'"';
				echo ' href="/'.$file.'"';
				echo '>';
				echo '<div class="crop">';
				echo ' <div class="picture"><img src="data/'.$file.'/picture.jpg"/></div>';
				echo ' <div class="description"><h3>'.$name.'</h3></div>';
				echo '</div>';
				echo '</a></div>';
				$curdir++;
			}
		}
	}
	closedir($handle);

	return($files);
}

returnimages();

?>