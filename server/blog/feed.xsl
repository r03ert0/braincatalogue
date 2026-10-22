<?xml version="1.0" encoding="utf-8"?>
<!--
	Makes /feed.xml readable in a browser. Feed readers ignore this file and
	read the feed itself. Only titles, dates and links are shown (no item
	bodies), which keeps the stylesheet simple and safe.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="utf-8" indent="yes" doctype-system="about:legacy-compat"/>

<xsl:template match="/rss/channel">
<html lang="en">
<head>
	<meta charset="utf-8"/>
	<meta name="viewport" content="width=device-width, initial-scale=1"/>
	<title><xsl:value-of select="title"/> (RSS feed)</title>
	<style>
		body { font-family: Georgia, serif; line-height: 1.5; color: #222; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
		h1 { font-size: 1.6rem; margin-bottom: .2rem; }
		.note { background: #f4f4f4; border-left: 4px solid #e8892b; padding: .8rem 1rem; margin: 1.2rem 0 2rem; font-size: .95rem; }
		code { background: #fff; padding: .1rem .3rem; border-radius: 3px; word-break: break-all; }
		ul { list-style: none; padding: 0; }
		li { margin: 0 0 1.2rem; }
		li a { font-size: 1.1rem; }
		.date { display: block; color: #666; font-size: .85rem; }
	</style>
</head>
<body>
	<h1><xsl:value-of select="title"/></h1>
	<p><xsl:value-of select="description"/></p>
	<div class="note">
		This is an RSS feed. To follow it, copy this address into your feed reader:<br/>
		<code><xsl:value-of select="*[local-name()='link' and @rel='self']/@href"/></code>
	</div>
	<ul>
		<xsl:for-each select="item">
			<li>
				<a href="{link}"><xsl:value-of select="title"/></a>
				<span class="date"><xsl:value-of select="pubDate"/></span>
			</li>
		</xsl:for-each>
	</ul>
	<p><a href="{link}">Go to the blog</a></p>
</body>
</html>
</xsl:template>

</xsl:stylesheet>
