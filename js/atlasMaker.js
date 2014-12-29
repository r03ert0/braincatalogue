//========================================================================================
// Globals
//========================================================================================
var debug=0;

var brain_offcn=document.createElement('canvas');
var brain_offtx=brain_offcn.getContext('2d');
var canvas;
var context;
var brain_px;
var	brain_W,brain_H,brain_D;
var	brain_Wdim,brain_Hdim;
var	max=0;
var	brain_dim=new Array(3);
var brain_pixdim=new Array(3);
var	brain_datatype;
var	brain=0;
var	brain_min,brain_max;
var	annotationLength=0;

var User={	       view:'sag',
				   tool:'paint',
				  slice:0,
				penSize:1,
			   penValue:1,
				 doFill:false,
			mouseIsDown:false,
					 x0:-1,
					 y0:-1,
				    mri:new Object()
		};
var	Collab=[];

var	atlas=new Array();
var atlas_offcn=document.createElement('canvas');
var atlas_offtx=atlas_offcn.getContext('2d');
var atlas_px;

var	name=AtlasMaker[0].name;
var	url=AtlasMaker[0].url;
var atlasName=AtlasMaker[0].atlasName;

var socket;
var flagConnected=0;
var	msg,msg0="";

var	prevData=0;

var Crsr={ x:undefined,			// cursor x coord
		   y:undefined,			// cursor y coord
		   fx:undefined,		// finger x coord
		   fy:undefined,		// finger y coord
		   x0:undefined,		// previous finger x coord
		   y0:undefined,		// previous finger y coord
		   cachedX:undefined,	// finger x coord at touch start
		   cachedY:undefined,	// finger y coord at touch start
		   state:"move",		// cursor state: move, draw, configure
		   prevState:undefined,	// state before configure
		   touchStarted:false	// touch started flag
		  };


//========================================================================================
// Local user interaction
//========================================================================================
function changeView(theView)
{
	if(debug) console.log("> changeView()");
	
	switch(theView)
	{
		case 'sagittal':
			User.view='sag';
			break;
		case 'coronal':
			User.view='cor';
			break;
		case 'axial':
			User.view='axi';
			break;
	}
	sendUserDataMessage();
	
	if(brain)
	{
		configureBrainImage();
		configureAtlasImage();
	}
	drawImages();
}
function changeTool(theTool)
{
	if(debug) console.log("> changeTool()");
	
	switch(theTool)
	{
		case 'paint':
			User.tool='paint';
			User.penValue=1;
			break;
		case 'erase':
			User.tool='erase';
			User.penValue=0;
			break;
	}
	sendUserDataMessage();
}
function changePenSize(theSize)
{
	if(debug) console.log("> changePenSize()");
	
	User.penSize=parseInt(theSize);
	sendUserDataMessage();
}
function changeSlice(e)
{
	if(debug) console.log("> changeSlice()");
	
	User.slice=parseInt($("#slider").slider("value"));
	sendUserDataMessage();

	drawImages();
}
function prevSlice()
{
	if(debug) console.log("> prevSlice()");
	
	User.slice=parseInt($("#slider").slider("value"))-1;
	if(User.slice<0)
		User.slice=0;
	sendUserDataMessage();

	$("#slider").slider("option","value",User.slice);
	drawImages();
}
function nextSlice()
{
	if(debug) console.log("> nextSlice()");
	
	User.slice=parseInt($("#slider").slider("value"))+1;
	if(User.slice>brain_D-1)
		User.slice=brain_D-1;
	sendUserDataMessage();

	$("#slider").slider("option","value",User.slice);
	drawImages();
}
function toggleFill()
{
	if(debug) console.log("> toggleFill()");
	
	User.doFill=!User.doFill;
	sendUserDataMessage();
}

function resizeWindow()
{
	if(debug) console.log("> resizeWindow()");
	
	var	wW=window.innerWidth;
	var	wH=window.innerHeight;
	var	wAspect=wW/wH;
	var	bAspect=brain_W/brain_H;
	if(wAspect>bAspect)
		$('#resizable').css('width',wH*bAspect).css('height',wH);
	else
		$('#resizable').css('width',wW).css('height',wW/bAspect);
}
function loadNifti()
{
	if(debug) console.log("> loadNifti()");
	
	var oReq = new XMLHttpRequest();
	var	progress=$(".atlasMaker span#download_mri");
	oReq.open("GET", User.dirname+"/"+User.mri.brain, true);
	oReq.addEventListener("progress", function(e){progress.html("Loading "+User.name+" ("+parseInt(100*e.loaded/e.total)+"%)")}, false);
	oReq.responseType = "arraybuffer";
	oReq.onload = function(oEvent)
	{
		var	inflate=new pako.Inflate();
		inflate.push(new Uint8Array(this.response),true);
		var data=inflate.result.buffer;
		var	dv=new DataView(data);
		var	sizeof_hdr=dv.getInt32(0,true);
		var	dimensions=dv.getInt16(40,true);
		brain_dim[0]=dv.getInt16(42,true);
		brain_dim[1]=dv.getInt16(44,true);
		brain_dim[2]=dv.getInt16(46,true);
		brain_datatype=dv.getInt16(72,true);
		brain_pixdim[0]=dv.getFloat32(80,true);
		brain_pixdim[1]=dv.getFloat32(84,true);
		brain_pixdim[2]=dv.getFloat32(88,true);
		var	vox_offset=dv.getFloat32(108,true);

		switch(brain_datatype)
		{
			case 8:
				brain=new Uint8Array(data,vox_offset);
				break;
			case 16:
				brain=new Int16Array(data,vox_offset);
				break;
			case 32:
				brain=new Float32Array(data,vox_offset);
				break;
		}

		brain_min=brain_max=brain[0];
		for(i=0;i<brain.length;i++)
		{
			if(brain[i]<brain_min)
				brain_min=brain[i];
			if(brain[i]>brain_max)
				brain_max=brain[i];
		}

		console.log("dim",brain_dim[0],brain_dim[1],brain_dim[2]);
		console.log("datatype",brain_datatype);
		console.log("pixdim",brain_pixdim[0],brain_pixdim[1],brain_pixdim[2]);
		console.log("vox_offset",vox_offset);
		configureBrainImage();
		configureAtlasImage();
		initCursor();
		progress.html("<a class='download_mri' href='"+User.dirname+User.mri.brain+"'><img src='/img/download.svg' style='vertical-align:middle'/></a>"+User.name);
		drawImages();		
	};
	oReq.send();
}
function saveNifti()
{
	if(debug) console.log("> saveNifti()");
	
	var	sizeof_hdr=348;
	var	dimensions=4;			// number of dimension values provided
	var	spacetimeunits=2+8;		// 2=nifti code for millimetres | 8=nifti code for seconds
	var	datatype=2;				// datatype for 8 bits (DT_UCHAR8 in nifti or UCHAR in analyze)
	var	voxel_offset=348;
	var	hdr=new ArrayBuffer(sizeof_hdr);
	var	dv=new DataView(hdr);
	dv.setInt32(0,sizeof_hdr,true);
	dv.setInt16(40,dimensions,true);
	dv.setInt16(42,brain_dim[0],true);
	dv.setInt16(44,brain_dim[1],true);
	dv.setInt16(46,brain_dim[2],true);
	dv.setInt16(48,1,true);
	dv.setInt16(70,datatype,true);
	dv.setInt16(74,8,true);			// bits per voxel
	dv.setFloat32(76,1,true);		// first pixdim value
	dv.setFloat32(80,brain_pixdim[0],true);
	dv.setFloat32(84,brain_pixdim[1],true);
	dv.setFloat32(88,brain_pixdim[2],true);
	dv.setFloat32(108,voxel_offset,true);
	dv.setInt8(123,spacetimeunits);

	var layer=atlas[0];
	var	data=layer.data;
	var	i;

	var nii = new Uint8Array(voxel_offset+data.length);
	for(i=0;i<sizeof_hdr;i++)
		nii[i]=dv.getUint8(i);
	for(i=0;i<data.length;i++)
		nii[i+voxel_offset]=data[i];
		
	var	deflate=new pako.Deflate({gzip:true});
	deflate.push(nii,true);
	var niigzBlob = new Blob([deflate.result]);
	
	$("a#download_atlas").attr("href",window.URL.createObjectURL(niigzBlob));
	$("a#download_atlas").attr("download",User.name+".nii.gz");
}
function configureBrainImage()
{
	if(debug) console.log("> configureBrainImage()");
	
	// init query image
	switch(User.view)
	{	case 'sag':	brain_W=brain_dim[1]/*PA*/; brain_H=brain_dim[2]/*IS*/; brain_D=brain_dim[0]; brain_Wdim=brain_pixdim[1]; brain_Hdim=brain_pixdim[2]; break; // sagital
		case 'cor':	brain_W=brain_dim[0]/*LR*/; brain_H=brain_dim[2]/*IS*/; brain_D=brain_dim[1]; brain_Wdim=brain_pixdim[0]; brain_Hdim=brain_pixdim[2]; break; // coronal
		case 'axi':	brain_W=brain_dim[0]/*LR*/; brain_H=brain_dim[1]/*PA*/; brain_D=brain_dim[2]; brain_Wdim=brain_pixdim[0]; brain_Hdim=brain_pixdim[1]; break; // axial
	}
	canvas.width=brain_W;
	canvas.height=brain_H;
	brain_offcn.width=brain_W;
	brain_offcn.height=brain_H;
	brain_px=brain_offtx.getImageData(0,0,brain_offcn.width,brain_offcn.height);

	resizeWindow();
		
//	var W=parseFloat($('#resizable').css('width'));
//	$('#resizable').css('height', (brain_H*brain_Hdim)*W/(brain_W*brain_Wdim) );
	
	User.slice=parseInt(brain_D/2);
	User.dim=brain_dim;
	sendUserDataMessage();
	$("#slider").slider("option","max",brain_D);
	$("#slider").slider("option","value",User.slice);
}
function configureAtlasImage()
{
	if(debug) console.log("> configureAtlasImage()");
	
	// has to be run *after* configureBrainImage
	atlas_offcn.width=brain_W;
	atlas_offcn.height=brain_H;
	atlas_px=atlas_offtx.getImageData(0,0,atlas_offcn.width,atlas_offcn.height);
}
function addAtlasLayer(dim)
{
	if(debug) console.log("> addAtlasLayer()");
	
	if(prevData)
	{
		if(debug)
			console.log("data available from server, use it");
	}
	
	atlas.push(layer);
}
function nearestNeighbour(ctx)
{
	if(debug) console.log("> nearestNeighbour()");
	
	ctx.imageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.mozImageSmoothingEnabled = false;

	ctx.mozImageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
}
function drawImages()
{
	if(debug) console.log("> drawImages()");
	
	context.clearRect(0,0,context.canvas.width,canvas.height);
	
	// draw brain
	if(brain)
	{
		drawBrainImage();
		context.globalAlpha = 0.8;
		context.globalCompositeOperation = "lighter";
		drawAtlasImage();
		$("#slice").html(User.slice);
	}
	else
	{
		var img = new Image();
  		img.src = User.dirname+"/"+User.view+".jpg";
  		img.onload = function(){
			var W=parseFloat($('#resizable').css('width'));
			var	w=this.width;
			var	h=this.height;
			$('#resizable').css('height', h*W/w );
			canvas.width=W;
			canvas.height=h*W/w;
			nearestNeighbour(context);
  			context.drawImage(this,0,0,W,h*W/w);
  		};
	}
}
function drawBrainImage()
{
	if(debug) console.log("> drawBrainImage()");
	
	if(brain==0)
		return;

	ys=yc=ya=User.slice;
	for(y=0;y<brain_H;y++)
	for(x=0;x<brain_W;x++)
	{
		switch(User.view)
		{	case 'sag':i= y*brain_dim[1]/*PA*/*brain_dim[0]/*LR*/+ x*brain_dim[0]/*LR*/+ys; break;
			case 'cor':i= y*brain_dim[1]/*PA*/*brain_dim[0]/*LR*/+yc*brain_dim[0]/*LR*/+x; break;
			case 'axi':i=ya*brain_dim[1]/*PA*/*brain_dim[0]/*LR*/+ y*brain_dim[0]/*LR*/+x; break;
		}
		val=255*(brain[i]-brain_min)/((brain_max-brain_min)||1);
		i=(y*brain_offcn.width+x)*4;
		brain_px.data[ i ]  =val;
		brain_px.data[ i+1 ]=val;
		brain_px.data[ i+2 ]=val;
		brain_px.data[ i+3 ]=255;
	}
	brain_offtx.putImageData(brain_px, 0, 0);

	nearestNeighbour(context);
	context.drawImage(brain_offcn,0,0,brain_W,brain_H);
}
function drawAtlasImage()
{
	if(debug) console.log("> drawAtlasImage()");
	
	if(!atlas[0])
		return;

	var layer=atlas[0];
	var	data=layer.data;
	var	dim=layer.dim;
	var	val;

	ys=yc=ya=User.slice;
	for(y=0;y<brain_H;y++)
	for(x=0;x<brain_W;x++)
	{
		switch(User.view)
		{	case 'sag':i= y*dim[1]/*PA*/*dim[0]/*LR*/+ x*dim[0]/*LR*/+ys; break;
			case 'cor':i= y*dim[1]/*PA*/*dim[0]/*LR*/+yc*dim[0]/*LR*/+x; break;
			case 'axi':i=ya*dim[1]/*PA*/*dim[0]/*LR*/+ y*dim[0]/*LR*/+x; break;
		}
		val=127*data[i];
		i=(y*atlas_offcn.width+x)*4;
		atlas_px.data[ i ]  =val;
		atlas_px.data[ i+1 ]=0;
		atlas_px.data[ i+2 ]=0;
		atlas_px.data[ i+3 ]=255;
	}
	atlas_offtx.putImageData(atlas_px, 0, 0);

	nearestNeighbour(context);
	context.drawImage(atlas_offcn,0,0,brain_W,brain_H);
}
function mousedown(e) {
	if(debug) console.log("> mousedown()");
	
	e.preventDefault();
	/*
	var r = e.target.getBoundingClientRect();
	var x=parseInt(((e.clientX-r.left) / e.target.clientWidth )*brain_W);
	var y=parseInt(((e.clientY-r.top) / e.target.clientHeight )*brain_H);
	*/
	var W=parseFloat($('#resizable canvas').css('width'));
	var H=parseFloat($('#resizable canvas').css('height'));
	var w=parseFloat($('#resizable canvas').attr('width'));
	var h=parseFloat($('#resizable canvas').attr('height'));
	var x=parseInt(e.clientX*(w/W));
	var y=parseInt(e.clientY*(h/H));
	
	down(x,y);
}
function mousemove(e) {
	if(debug==2)
		console.log("> mousemove()");
	
	e.preventDefault();
	var W=parseFloat($('#resizable canvas').css('width'));
	var H=parseFloat($('#resizable canvas').css('height'));
	var w=parseFloat($('#resizable canvas').attr('width'));
	var h=parseFloat($('#resizable canvas').attr('height'));
	var x=parseInt(e.clientX*(w/W));
	var y=parseInt(e.clientY*(h/H));
	
	$("#cursor").css({left:x*(W/w),top:y*(H/h),width:User.penSize*(W/w),height:User.penSize*(H/h)});
	move(x,y);
}
function mouseup(e) {
	if(debug) console.log("> mouseup()");
	
	up(e);
}
function touchstart(e) {
	if(debug)
		console.log("> touchstart()");
	
	e.preventDefault();
	var r = e.target.getBoundingClientRect();
	var	touchEvent=e.originalEvent.changedTouches[0];
	var W=parseFloat($('#resizable canvas').css('width'));
	var H=parseFloat($('#resizable canvas').css('height'));
	var w=parseFloat($('#resizable canvas').attr('width'));
	var h=parseFloat($('#resizable canvas').attr('height'));
	var x=parseInt(touchEvent.pageX*(w/W));
	var y=parseInt(touchEvent.pageY*(h/H));
	
	/*-- Precision cursor --*/
	$("#finger").css("display","inline");
	Crsr.x0=Crsr.cachedX=x;
	Crsr.y0=Crsr.cachedY=y;
	Crsr.touchStarted=true;
	setTimeout(function() {
		if(Crsr.cachedX == Crsr.x0 && Crsr.cachedY==Crsr.y0 && !Crsr.touchStarted) {
			Crsr.state=(Crsr.state=="move")?"draw":"move";
			updateCursor();
		}
	},200);
	setTimeout(function() {
		if (Crsr.cachedX==Crsr.x0 && Crsr.cachedY==Crsr.y0 && Crsr.touchStarted) {
			Crsr.prevState=Crsr.state;
			Crsr.state="configure";
			updateCursor();
		}
	},1000);
	/*----------------------*/

	down(Crsr.x,Crsr.y);
}
function touchmove(e) {
	if(debug)
		console.log("> touchmove()");
	
	e.preventDefault();
	/*
	var r = e.target.getBoundingClientRect();
	*/
	var	touchEvent=e.originalEvent.changedTouches[0];
	var W=parseFloat($('#resizable canvas').css('width'));
	var H=parseFloat($('#resizable canvas').css('height'));
	var w=parseFloat($('#resizable canvas').attr('width'));
	var h=parseFloat($('#resizable canvas').attr('height'));
	var x=parseInt(touchEvent.pageX*(w/W));
	var y=parseInt(touchEvent.pageY*(h/H));
	
	/*-- Precision cursor --*/
	var dx=x-Crsr.x0;
	var dy=y-Crsr.y0;
	if(Crsr.state=="move"||Crsr.state=="draw") {
		Crsr.x+=dx;
		Crsr.y+=dy;
		$("#cursor").css({left:Crsr.x*(W/w),top:Crsr.y*(H/h),width:User.penSize*(W/w),height:User.penSize*(H/h)});
		if(Crsr.state=="draw")
			move(Crsr.x,Crsr.y);
	}
	Crsr.fx+=dx;
	Crsr.fy+=dy;
	$("#finger").css({left:Crsr.fx*(W/w)+"px",top:Crsr.fy*(H/h)+"px"});
	Crsr.x0=x;
	Crsr.y0=y;
}
function touchend(e) {
	if(debug) console.log("> touchend()");
	
	/*-- Precision cursor --*/
	Crsr.touchStarted=false;
	if(Crsr.state=="configure") {
		Crsr.state=Crsr.prevState;
		updateCursor();
	}
	/*----------------------*/
	
	up(e);
}
function initCursor() {
	var W=parseFloat($('#resizable canvas').css('width'));
	var H=parseFloat($('#resizable canvas').css('height'));
	var w=parseFloat($('#resizable canvas').attr('width'));
	var h=parseFloat($('#resizable canvas').attr('height'));
	Crsr.x=parseInt(w/2);
	Crsr.y=parseInt(h/2);
	Crsr.fx=parseInt(w/2);
	Crsr.fy=parseInt(h/2);
	$("#cursor").css({left:(Crsr.x*(W/w))+"px",top:(Crsr.y*(H/h))+"px",width:User.penSize*(W/w),height:User.penSize*(H/h)});
	$("#finger").css({left:(Crsr.fx*(W/w))+"px",top:(Crsr.fy*(H/h))+"px"});
}
function updateCursor() {
    $("#finger").removeClass("move draw configure");
    switch(Crsr.state) {
        case "move": $("#finger").addClass("move");	break;
        case "draw": $("#finger").addClass("draw");	break;
        case "configure": $("#finger").addClass("configure");	break;
    }
    //$("#msg").html(C.state);
    console.log(Crsr.state);
}
function down(x,y) {
	if(debug) console.log("> down()");
	
	if(MyLoginWidget.loggedin==0)
		return;
	
	var z=User.slice;

	if(User.doFill)
	{
		if(User.penValue==0)
			paintxy(-1,'e',x,y,User);
		else
			paintxy(-1,'f',x,y,User);
	}
	else
	{
		User.mouseIsDown = true;
		sendUserDataMessage();
		if(User.tool=='paint')
			paintxy(-1,'mf',x,y,User);
		else
		if(User.tool=='erase')
			paintxy(-1,'me',x,y,User);
	}
	
	// init annotation length counter
	annotationLength=0;
}
function move(x,y) {
	if(debug==2) console.log("> move()");
	
	if(MyLoginWidget.loggedin==0)
		return;

	var z=User.slice;

	if(!User.mouseIsDown)
		return;
	if(User.tool=='paint')
		paintxy(-1,'lf',x,y,User);
	else
	if(User.tool=='erase')
		paintxy(-1,'le',x,y,User);

}
function up(e) {
	if(debug) console.log("> up()");

	if(MyLoginWidget.loggedin==0)
		return;

	User.mouseIsDown = false;
	User.x0=-1;
	sendUserDataMessage();
	
	// add annotated length to User.annotation length and post to DB
	logAnnotationLength();
	annotationLength=0;
}
function keyDown(e)
{
	if(debug) console.log("> keyDown()");
	
	if(e.which==37) {	// left arrow
		prevSlice();
		e.preventDefault();
	}
	if(e.which==39) {	// right arrow
		nextSlice(this);
		e.preventDefault();
	}
}

//========================================================================================
// Paint functions common to all users
//========================================================================================
function paintxy(u,c,x,y,usr)
{
	if(debug) console.log("> paintxy()");
	
	// u: user number
	// c: command
	// x, y: coordinates
	msg=JSON.stringify({"c":c,"x":x,"y":y});
	if(u==-1 && msg!=msg0)
	{
		sendPaintMessage(msg);
		msg0=msg;
	}
	
	var	layer=atlas[0];
	var	dim=layer.dim;
	
	var	coord={"x":x,"y":y,"z":usr.slice};
	if(usr.x0<0) {
		usr.x0=coord.x;
		usr.y0=coord.y;
	}
	
	switch(c)
	{
		case 'le':
			line(coord.x,coord.y,0,usr);
			break;
		case 'lf':
			line(coord.x,coord.y,1,usr);
			break;
		case 'f':
			fill(coord.x,coord.y,coord.z,1,usr.view);
			break;
		case 'e':
			fill(coord.x,coord.y,coord.z,0,usr.view);
			break;
	}

	usr.x0=coord.x;
	usr.y0=coord.y;
}
function fill(x,y,z,val,myView)
{
	if(debug) console.log("> fill()");
	
	var	Q=[],n;
	var	layer=atlas[0];
	var	dim=layer.dim;
	var	i;
		
	Q.push({"x":x,"y":y});
	while(Q.length>0)
	{
		n=Q.pop();
		x=n.x;
		y=n.y;
		if(layer.data[slice2index(x,y,z,myView)]!=val)
		{
			layer.data[slice2index(x,y,z,myView)]=val;
			if(x-1>=0 && layer.data[slice2index(x-1,y,z,myView)]!=val)
				Q.push({"x":x-1,"y":y});
			if(x+1<brain_W && layer.data[slice2index(x+1,y,z,myView)]!=val)
				Q.push({"x":x+1,"y":y});
			if(y-1>=0 && layer.data[slice2index(x,y-1,z,myView)]!=val)
				Q.push({"x":x,"y":y-1});
			if(y+1<brain_H && layer.data[slice2index(x,y+1,z,myView)]!=val)
				Q.push({"x":x,"y":y+1});
		}
	}
	drawImages();
}
function line(x,y,val,usr)
{
	if(debug) console.log("> line()");
	
	// Bresenham's line algorithm adapted from
	// http://stackoverflow.com/questions/4672279/bresenham-algorithm-in-javascript

	var	layer=atlas[0];
	var	dim=layer.dim;
	var	xyzi1=new Array(4);
	var	xyzi2=new Array(4);
	var	i;
	var	x1=usr.x0;
	var y1=usr.y0;
	var x2=x;
	var y2=y;
	var	z=usr.slice;

    // Define differences and error check
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    var sx = (x1 < x2) ? 1 : -1;
    var sy = (y1 < y2) ? 1 : -1;
    var err = dx - dy;

    xyzi1=slice2xyzi(x1,y1,z,usr.view);
    xyzi2=slice2xyzi(x2,y2,z,usr.view);
    annotationLength+=Math.sqrt(	Math.pow(brain_pixdim[0]*(xyzi1[0]-xyzi2[0]),2)+
    								Math.pow(brain_pixdim[1]*(xyzi1[1]-xyzi2[1]),2)+
    								Math.pow(brain_pixdim[2]*(xyzi1[2]-xyzi2[2]),2));
    
    i=xyzi1[3];
    layer.data[i]=val;
    
	while (!((x1 == x2) && (y1 == y2)))
	{
		var e2 = err << 1;
		if (e2 > -dy)
		{
			err -= dy;
			x1 += sx;
		}
		if (e2 < dx)
		{
			err += dx;
			y1 += sy;
		}
		for(j=0;j<usr.penSize;j++)
		for(k=0;k<usr.penSize;k++)
		{
			i=slice2index(x1+j,y1+k,z,usr.view);
			layer.data[i]=val;
		}
	}
	drawImages();
}
function slice2index(mx,my,mz,myView)
{
	if(debug) console.log("> slice2index()");
	
	var	layer=atlas[0];
	var	dim=layer.dim;
	var	x,y,z;
	switch(myView)
	{	case 'sag':	x=mz; y=mx; z=my;break; // sagital
		case 'cor':	x=mx; y=mz; z=my;break; // coronal
		case 'axi':	x=mx; y=my; z=mz;break; // axial
	}	
	return z*dim[1]*dim[0]+y*dim[0]+x;	
}
function slice2xyzi(mx,my,mz,myView)
{
	if(debug) console.log("> slice2xyzi()");
	
	var	layer=atlas[0];
	var	dim=layer.dim;
	var	x,y,z,i;
	switch(myView)
	{	case 'sag':	x=mz; y=mx; z=my;break; // sagital
		case 'cor':	x=mx; y=mz; z=my;break; // coronal
		case 'axi':	x=mx; y=my; z=mz;break; // axial
	}
	i=z*dim[1]*dim[0]+y*dim[0]+x;
	return [x,y,z,i];	
}
function xyz2slice(x,y,z,myView)
{
	if(debug) console.log("> xyz2slice()");
	
	var	mx,my,mz;
	switch(myView)
	{	case 'sag':	mz=x; mx=y; my=z;break; // sagital
		case 'cor':	mx=x; mz=y; my=z;break; // coronal
		case 'axi':	mx=x; my=y; mz=z;break; // axial
	}	
	return new Object({"x":x,"y":y,"z":z});	
}

//========================================================================================
// Web sockets
//========================================================================================
function createSocket(host) {
	if(debug) console.log("> createSocket()");
	
	if (window.WebSocket)
		return new WebSocket(host);
	else if (window.MozWebSocket)
		return new MozWebSocket(host);
}
function initSocketConnection() {
	if(debug) console.log("> initSocketConnection()");
	
	// WS connection
	var host = "ws://" + window.location.host + ":12345/echo";
	
	if(debug)
		console.log("[initSocketConnection] host:",host);
	
	try {
		socket = createSocket(host);
		socket.onopen = function(msg) {
			$("#chat").text("Chat (1 connected)");
			flagConnected=1;
			sendUserDataMessage();
		};
		socket.onmessage = function(msg) {
			// Message: label data initialisation
			if(msg.data instanceof Blob) {
				if(debug)
					console.log("received data blob",msg.data.size,"bytes long");
				var fileReader = new FileReader();
				fileReader.onload = function() {
					var	inflate=new pako.Inflate();
					inflate.push(new Uint8Array(this.result),true);
					var layer=new Object();
					layer.data=inflate.result;
					layer.name=AtlasMaker[0].atlasName;
					layer.dim=brain_dim;
					atlas.push(layer);
					drawImages();
					var	link=$(".atlasMaker span#download_atlas");
					link.html("<a class='download' href='"+User.dirname+User.mri.atlas+"'><img src='/img/download.svg' style='vertical-align:middle'/></a>"+layer.name);
				};
				fileReader.readAsArrayBuffer(msg.data);
				return;
			}
			
			// Message: interaction message
			var	data=$.parseJSON(msg.data);
			
			// If we receive a message from an unknown user,
			// send our own data to make us known
			if(!Collab[data.uid])
				sendUserDataMessage();
			
			switch(data.type)
			{
				case "intro":
					receiveUserDataMessage(data);
					break;
				case "chat":
					receiveChatMessage(data);
					break;
				case "paint":
					receivePaintMessage(data);
					break;
				case "disconnect":
					receiveDisconnectMessage(data);
					break;
			}
		};
		socket.onclose = function(msg) {
			$("#chat").text("Chat (not connected - server closed)");
			flagConnected=0;
		};
	}
	catch (ex) {
		$("#chat").text("Chat (not connected - connection error)");
	}
}
function sendUserDataMessage() {
	if(debug) console.log("> sendUserDataMessage()");
		
	if(flagConnected==0)
		return;
	var msg=JSON.stringify({"type":"intro","user":JSON.stringify(User)});
	try {
		socket.send(msg);
	} catch (ex) {
		console.log("ERROR: Unable to sendUserDataMessage",ex);
	}
}
function receiveUserDataMessage(data) {
	if(debug) console.log("> receiveUserDataMessage()");
	
	var u=data.uid;
	var usr=$.parseJSON(data.user);
	Collab[u]=usr;
	
	var	nusers=1+Collab.filter(function(value) { return value !== undefined }).length;
	$("#chat").text("Chat ("+nusers+" connected)");
}
function sendChatMessage() {
	if(debug) console.log("> sendChatMessage()");
	
	if(flagConnected==0)
		return;
	var msg = $('input#msg')[0].value;
	try {
		socket.send(JSON.stringify({"type":"chat","msg":msg,"username":User.username}));
		var	msg="<b>me: </b>"+msg+"<br />";
		$("#log").append(msg);
		$("#log").scrollTop($("#log")[0].scrollHeight);
		$('input#msg').val("");
	} catch (ex) {
		console.log("ERROR: Unable to sendChatMessage",ex);
	}
}
function receiveChatMessage(data) {
	if(debug) console.log("> receiveChatMessage()");
	
	var	theView=Collab[data.uid].view;
	var	theSlice=Collab[data.uid].slice;
	var theUsername=data.username;
	var	msg="<b>"+theUsername+" ("+theView+" "+theSlice+"): </b>"+data.msg+"<br />"
	$("#log").append(msg);
	$("#log").scrollTop($("#log")[0].scrollHeight);
}
function sendPaintMessage(msg) {
	if(debug) console.log("> sendPaintMessage()");
	
	if(flagConnected==0)
		return;
	try {
		socket.send(JSON.stringify({"type":"paint","data":msg}));
	} catch (ex) {
		console.log("ERROR: Unable to sendPaintMessage",ex);
	}
}
function receivePaintMessage(data) {
	if(debug) console.log("> receivePaintMessage()");
	
	var	msg=$.parseJSON(data.data);
	var u=parseInt(data.uid);	// user
	var c=msg.c;	// command
	var x=parseInt(msg.x);	// x coordinate
	var y=parseInt(msg.y);	// y coordinate

	paintxy(u,c,x,y,Collab[u]);
}
function receiveDisconnectMessage(data) {
	if(debug) console.log("> receiveDisconnectMessage()");
	
	var u=parseInt(data.uid);	// user
	Collab[u]=undefined;
	
	var	nusers=1+Collab.filter(function(value) { return value !== undefined }).length;
	$("#chat").text("Chat ("+nusers+" connected)");

	var	msg="<b>"+data.uid+"</b> left<br />"
	$("#log").append(msg);
	$("#log").scrollTop($("#log")[0].scrollHeight);
}
function onkey(event) {
	if(debug) console.log("> onkey()");
	
	if (event.keyCode == 13) {
		sendChatMessage();
	}
}
function quit() {
	if(debug) console.log("> quit()");
	
	log("","Goodbye!");
	socket.close();
	socket = null;
}
//==========
// Database
//==========
function logAnnotationLength()
{
	$.ajax({
		url:"/php/braincatalogue.php",
		type:"GET",
		data: {
			action:"add_log",
			userName:MyLoginWidget.username,
			key:"annotationLength",
			value:'{"specimen":"'+name+'","atlas":"'+atlas[0].name+'","length":'+annotationLength+'}'
	}})
	.done(function(data) {
		var length=parseInt(data);
		$("#info").text("length: "+length+" mm");
	})
	.fail(function() {
		console.log( "error" );
	});
}


//========================================================================================
// Configuration
//========================================================================================
function init()
{
	if(debug) console.log("> init()");
	
	// 1. Add widget div
	//var div = Siph.settings[0].container;
	$(document.body).append("<div class='atlasMaker'></div>");

	// 2. Load "experiment" template
	$("div.atlasMaker").load("/templates/atlasMakerTools.html",
		function(responseText, textStatus, XMLHttpRequest) {
			initAtlasMaker();
		}
	);
	
	// 3. Add cursor
	$(document.body).append("<div id='cursor'></div>");
	var isTouchArr=["iPad","iPod"];
	var curDevice=navigator.userAgent.split(/[(;]/)[1];
	if($.inArray(curDevice,isTouchArr)>=0) {
		$(document.body).append("<div id='finger'></div>");
		$("#finger").css({display:"inline"});
		updateCursor();
	}
}
function loginChanged()
{
	if(debug)
		console.log("[loginChanged] changed to",MyLoginWidget.loggedin);
	if(MyLoginWidget.loggedin)
	{
		$(".loginRequired").show();	// Show all controls that required to be logged in
		User.username=MyLoginWidget.username;
	}
	else
		$(".loginRequired").hide();	// Hide all controls that required to be logged in
}
function initAtlasMaker()
{
	if(debug) console.log("> initAtlasMaker()");
	
	// Init canvas
	canvas = document.getElementById('canvas');
	context = canvas.getContext('2d');

	// configure canvas for desktop computers
	canvas.onmousedown = mousedown;
	canvas.onmousemove = mousemove;
	canvas.onmouseup = mouseup;
	
	// configure canvas for tablets
	$("#finger").on("touchstart",function(e){touchstart(e)});
	$("#finger").on("touchend",function(e){touchend(e)});
	$("#finger").on("touchmove",function(e){touchmove(e)});


	$(window).resize(function() {
		resizeWindow();
	});

	//==========
	// Init GUI
	//==========

	// hide or show annotation tools depending on login changes
	loginChanged();
	if(MyLoginWidget)
	{
		console.log("subscribing to login changes");
		MyLoginWidget.subscribe(loginChanged);
	}

	// configure annotation tools
	$("a#download_atlas").button().click(function(){saveNifti()});

	$("button#save").button().click(function(){console.log("save")});
	$("button#import_nii").button().click(function(){console.log("import_nii")});

	$("div#plane").buttonset().unbind('keydown');
	$("#plane input[type=radio]").change(function(){changeView($(this).attr('id'))})

	$("span#tool").buttonset().unbind('keydown');
	$("#tool input[type=radio]").change(function(){changeTool($(this).attr('id'))})

	$("input#fill").button().click(function(){toggleFill()});
	
	$("div#penSize").buttonset().unbind('keydown');
	$("#penSize input[type=radio]").change(function(){changePenSize($(this).attr('id'))});
		
	$("#slider").slider({slide:changeSlice,min:0,step:1});
	$("button#prevSlice").button().click(function(){prevSlice()});
	$("button#nextSlice").button().click(function(){nextSlice()});

	$("div#toolbar").draggable().resizable({resize:function(){$("#log").outerHeight($(this).innerHeight()-$("#controls").outerHeight(true)-$("label#chat").outerHeight(true)-$("#msg").outerHeight(true))}});
	$("div#toolbar").draggable().resizable();
	$("div#toolbar").blur();
	
	// Intercept keyboard events
	//$("#slider").unbind('keydown');
	//$("#slider").unbind('keypress');
	$(document).keydown(function(e){keyDown(e)});

	// Load dataset's json file
	User.dirname=url.replace(/^http:\/\/[^\/]*/,'').replace(/[^\/]*$/,'');
	var oReq = new XMLHttpRequest();
	console.log("initAtlasMaker url",url);
	oReq.open("GET", url, true);
	oReq.responseType = "string";
	oReq.onload = function(oEvent)
	{
        var data=JSON.parse(this.response);
        User.mri=data.mri;
        User.name=data.name
        loadNifti();
        initSocketConnection();
		drawImages();
	};
	oReq.send();
}

init();

/*
				 0		int   sizeof_hdr;    //!< MUST be 348           //  // int sizeof_hdr;      //
				 4		char  data_type[10]; //!< ++UNUSED++            //  // char data_type[10];  //
				 14		char  db_name[18];   //!< ++UNUSED++            //  // char db_name[18];    //
				 32		int   extents;       //!< ++UNUSED++            //  // int extents;         //
				 36		short session_error; //!< ++UNUSED++            //  // short session_error; //
				 38		char  regular;       //!< ++UNUSED++            //  // char regular;        //
				 39		char  dim_info;      //!< MRI slice ordering.   //  // char hkey_un0;       //

													  //--- was image_dimension substruct ---//
				 40		short dim[8];        //!< Data array dimensions.//  // short dim[8];        //
				 56		float intent_p1 ;    //!< 1st intent parameter. //  // short unused8;       //
																	 // short unused9;       //
				 60		float intent_p2 ;    //!< 2nd intent parameter. //  // short unused10;      //
																	 // short unused11;      //
				 64		float intent_p3 ;    //!< 3rd intent parameter. //  // short unused12;      //
																	 // short unused13;      //
				 68		short intent_code ;  //!< NIFTI_INTENT_* code.  //  // short unused14;      //
				 70		short datatype;      //!< Defines data type!    //  // short datatype;      //
				 72		short bitpix;        //!< Number bits/voxel.    //  // short bitpix;        //
				 74		short slice_start;   //!< First slice index.    //  // short dim_un0;       //
				 76		float pixdim[8];     //!< Grid spacings.        //  // float pixdim[8];     //
				 108	float vox_offset;    //!< Offset into .nii file //  // float vox_offset;    //
				 112	float scl_slope ;    //!< Data scaling: slope.  //  // float funused1;      //
				 116	float scl_inter ;    //!< Data scaling: offset. //  // float funused2;      //
				 120	short slice_end;     //!< Last slice index.     //  // float funused3;      //
				 122	char  slice_code ;   //!< Slice timing order.   //
				 123	char  xyzt_units ;   //!< Units of pixdim[1..4] //
				 124	float cal_max;       //!< Max display intensity //  // float cal_max;       //
				 128	float cal_min;       //!< Min display intensity //  // float cal_min;       //
				 132	float slice_duration;//!< Time for 1 slice.     //  // float compressed;    //
				 136	float toffset;       //!< Time axis shift.      //  // float verified;      //
				 140	int   glmax;         //!< ++UNUSED++            //  // int glmax;           //
				 144	int   glmin;         //!< ++UNUSED++            //  // int glmin;           //
*/