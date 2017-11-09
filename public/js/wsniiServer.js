var os=require("os");
var fs=require("fs");
var zlib=require("zlib");
var req=require('request');
var jpeg=require('jpeg-js'); // jpeg-js library: https://github.com/eugeneware/jpeg-js

var	debug=1;
var WebSocketServer=require("ws").Server; // https://github.com/websockets/ws
var websocket;

var brain={};
var datatype=2;
var	vox_offset=352;
var jpegImageData;

initSocketConnection();

function initSocketConnection() {
	var host = "ws://localhost:8080";
	try
	{
		websocket = new WebSocketServer({port:8080});
		websocket.on("connection",function(s)
		{
			console.log("server started");
			s.send(JSON.stringify({msg:"Loading nii"}));
			loadNifti("../data/Human/MRI-n4.nii.gz",s);
			s.on('message',function(msg)
			{
				var	data=JSON.parse(msg);
				switch(data.type)
				{
					case "echo":
						console.log("ECHO: '"+data.msg+"'");
						break;
					case "chat":
						console.log("CHAT: '"+data.msg+"'");
						s.send(JSON.stringify({msg:"toi même"}));
						break;
					case "slice":
						var jpegImageData=drawSlice(brain,data.view,data.slice);
						s.send(jpegImageData.data, {binary: true, mask: false});
						break;
				}
			});
			s.on('close',function(msg)
			{
				console.log("close");
			});
		});
	}
	catch (ex)
	{
		console.log(new Date(),"ERROR: Unable to create a server",ex);
	}
}

function loadNifti(path,socket) {
	if(!fs.existsSync(path)) {
		console.log("ERROR: File does not exist");
		socket.send(JSON.stringify({type:"result",msg:"ERROR: File does not exist"}));
		return;
	} else {
		var niigz;
		try {
			niigz=fs.readFileSync(path);
			zlib.gunzip(niigz,function(err,nii) {
				var	sizeof_hdr=nii.readUInt32LE(0);
				var	dimensions=nii.readUInt16LE(40);
				brain.hdr=nii.slice(0,vox_offset);
				brain.dim=[];
				brain.dim[0]=nii.readUInt16LE(42);
				brain.dim[1]=nii.readUInt16LE(44);
				brain.dim[2]=nii.readUInt16LE(46);
				datatype=nii.readUInt16LE(72);
				brain.pixdim=[];
				brain.pixdim[0]=nii.readFloatLE(80);
				brain.pixdim[1]=nii.readFloatLE(84);
				brain.pixdim[2]=nii.readFloatLE(88);
				vox_offset=nii.readFloatLE(108);
				brain.data=nii.slice(vox_offset);
				var i,sum=0;
				for(i=0;i<brain.dim[0]*brain.dim[1]*brain.dim[2];i++)
					sum+=brain.data[i];
				brain.sum=sum;
				
				console.log("nii file loaded",sum);
				var msg=JSON.stringify({type:"result",msg:"File loaded"});
				socket.send(msg);
			});
		} catch(e) {
			console.log(new Date(),"ERROR: Cannot read brain data");
		}
	}
}

function drawSlice(brain,view,slice) {
	var x,y,i,j;
	var brain_W, brain_H;
	var brain_Wdim,brain_Hdim;
	var ys,ya,yc;
	
	switch(view)
	{	case 'sag':	brain_W=brain.dim[1]; brain_H=brain.dim[2]; brain_D=brain.dim[0]; break; // sagital
		case 'cor':	brain_W=brain.dim[0]; brain_H=brain.dim[2]; brain_D=brain.dim[1]; break; // coronal
		case 'axi':	brain_W=brain.dim[0]; brain_H=brain.dim[1]; brain_D=brain.dim[2]; break; // axial
	}
	
	var frameData = new Buffer(brain_W * brain_H * 4);

	j=0;
	switch(view)
	{	case 'sag':ys=parseInt(brain.dim[0]*slice); break;
		case 'cor':yc=parseInt(brain.dim[1]*slice); break;
		case 'axi':ya=parseInt(brain.dim[2]*slice); break;
	}
	//ys=yc=ya=slice;
	for(y=0;y<brain_H;y++)
	for(x=0;x<brain_W;x++)
	{
		switch(view)
		{	case 'sag':i= y*brain.dim[1]*brain.dim[0]+ x*brain.dim[0]+ys; break;
			case 'cor':i= y*brain.dim[1]*brain.dim[0]+yc*brain.dim[0]+x; break;
			case 'axi':i=ya*brain.dim[1]*brain.dim[0]+ y*brain.dim[0]+x; break;
		}
	  frameData[4*j+0] = brain.data[i]; // red
	  frameData[4*j+1] = brain.data[i]; // green
	  frameData[4*j+2] = brain.data[i]; // blue
	  frameData[4*j+3] = 0xFF; // alpha - ignored in JPEGs
	  j++;
	}

	var rawImageData = {
	  data: frameData,
	  width: brain_W,
	  height: brain_H
	};
	return jpeg.encode(rawImageData,90);
}
