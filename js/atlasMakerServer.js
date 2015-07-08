/*
	Atlas Maker Server
	Roberto Toro, 25 July 2014
	
	Launch using > node atlasMakerServer.js
*/

var	debug=1;

var WebSocketServer=require("ws").Server;
var os=require("os");
var fs=require("fs");
var zlib=require("zlib");

var socket;
var	Atlases=[];
var	Users=[];
var	usrsckts=[];
var	localdir=__dirname+"/../";
var	uidcounter=1;

var UndoStack=[];

console.log("atlasMakerServer.js");
console.log(new Date());
console.log("free memory",os.freemem());

initSocketConnection();

//========================================================================================
// Web socket
//========================================================================================
function getUserId(socket) {
	for(var i in usrsckts) {
		if(socket==usrsckts[i].socket)
			return usrsckts[i].uid;
	}
	return -1;
}
function removeUser(socket) {
	for(var i in usrsckts) {
		if(socket==usrsckts[i].socket)
		{
			usrsckts.splice(i,1);
			break;
		}
	}
}
function initSocketConnection() {
	// WS connection
	var host = "ws://localhost:12345/echo";
	
	if(debug)
		console.log(new Date(),"[initSocketConnection] host:",host);
	
	try
	{
		var websocket = new WebSocketServer({port:12345});
		websocket.on("connection",function(s)
		{
			console.log(new Date(),"[connection open]");
			var	usr={"uid":uidcounter++,"socket":s};
			usrsckts.push(usr);
			console.log("User id "+usr.uid+
						" connected, total: "+usrsckts.length+" users");
			
			socket=s;
			s.on('message',function(msg)
			{
				if(debug)
					console.log(new Date(),"[connection: message]");
				var uid=getUserId(this);
				var	data=JSON.parse(msg);
				data.uid=uid;
				msg=JSON.stringify(data);
				if(debug)
					console.log("UID:",data.uid);
				
				// broadcast
				for(var i in socket.clients)
				{
					// i-th user
					var uid=getUserId(socket.clients[i]);
					
					// don't broadcast if it's the same user
					if(data.uid==uid)
						continue;
					// don't broadcast to users using a different atlas
					if((   Users[data.uid]
						&& Users[uid]
						&& (Users[uid].iAtlas!=Users[data.uid].iAtlas)
					  ))
						continue;
					socket.clients[i].send(msg);
				}

				// integrate paint messages
				switch(data.type)
				{
					case "intro":
						receiveUserDataMessage(data);
						break;
					case "paint":
						receivePaintMessage(data);
						break;
				}
			});
			
			s.on('close',function(msg)
			{
				console.log(new Date());
				console.log("[connection: close]");
				console.log("usrsckts length",usrsckts.length);
				for(var i in usrsckts)
					if(usrsckts[i].socket==s)
						console.log("user",usrsckts[i].uid,"is closing connection");
				var uid=getUserId(this);
				var u=uid;	// user
				console.log("User ID "+u+" is disconnecting");
				if(Users[u].dirname)
					console.log("User was connected to atlas "+ Users[u].dirname+Users[u].mri.atlas);
				else
					console.log("User was not connected to any atlas");					
				
				// count how many users remain connected to the atlas after user leaves
				var sum=0;
				for(i in Users)
					if(Users[i].dirname==Users[u].dirname
						&& Users[i].mri.atlas==Users[u].mri.atlas)
						sum++;
				sum--;
				if(sum)
					console.log("There remain "+sum+" users connected to that atlas");
				else
				{
					console.log("No user connected to atlas "
								+ Users[u].dirname
								+ Users[u].mri.atlas+": unloading it");
					for(i in Atlases)
					{
						if(Atlases[i].dirname==Users[u].dirname
							&& Atlases[i].name==Users[u].mri.atlas)
						{
							saveNifti(Atlases[i]);
							clearInterval(Atlases[i].timer);
							Atlases.splice(i,1);
							console.log("free memory",os.freemem());
							break;
						}
					}
				}
				
				// remove the user from the list
				Users.splice(u,1);
				removeUser(this);
				
				// display the total number of connected users
				var	nusers=Users.filter(function(value){
					return value !== undefined
				}).length;
				if(debug)
				{
					console.log("user",u,"closed connection");
					console.log(nusers+" connected");
				}
			});
		});
	}
	catch (ex)
	{
		console.log(new Date(),"ERROR: Unable to create a server",ex);
	}
}
function receivePaintMessage(data) {
	if(debug)
		console.log(new Date(),"[receivePaintMessage]");

	var	msg=JSON.parse(data.data);
	var u=parseInt(data.uid);	// user id
	var	user=Users[u];			// user data
	var c=msg.c;				// command
	var x=parseInt(msg.x);		// x coordinate
	var y=parseInt(msg.y);		// y coordinate
	var undoLayer=getCurrentUndoLayer(user);	// current undoLayer for user
	
	// console.log("PaintMessage u",user,"user",user);
	paintxy(u,c,x,y,user,undoLayer);
}
function receiveUserDataMessage(data)
{
	if(debug)
		console.log(new Date(),"[receiveUserDataMessage]");

	var u=data.uid;
	var user=JSON.parse(data.user);
	var	i,atlasLoadedFlag,firstConnectionFlag;
	
	if(debug)
		console.log("DataMessage user:",user);
	firstConnectionFlag=(Users[u]==undefined);

	// 1. Check if the atlas the user is requesting has not been loaded
	atlasLoadedFlag=false;
	for(i=0;i<Atlases.length;i++)
		if(Atlases[i].dirname==user.dirname && Atlases[i].name==user.mri.atlas)
		{
			atlasLoadedFlag=true;
			break;
		}
	user.iAtlas=i;	// i-th value if it was found, or last if it wasn't
	
	
	// 2. Send the atlas to the user (load it if required)
	if(atlasLoadedFlag)
	{
		if(firstConnectionFlag)
		{
			// send the new user our data
			sendAtlasToUser(Atlases[i].data);
		}
	}
	else
	{
		// the atlas requested has not been loaded before
		// load the atlas she's requesting
		addAtlas(user.dirname,user.mri.atlas,user.dim,function(atlas){sendAtlasToUser(atlas)});
	}	
	
	// 3. Update user data
	// If the user didn't have a name (wasn't logged in), but now has one,
	// display the name in the log
	if(user.hasOwnProperty('username'))
	{
		if(Users[u]==undefined)
			console.log(new Date(),"No User yet for id "+u, user);
		else
		if(!Users[u].hasOwnProperty('username')) {
			console.log(new Date(),"User "+user.username+", id "+u+" logged in");
		}
	}
	//else
	//	console.log(new Date(),"Name unknown for user id "+u);
	Users[u]=user;

	// 4. Update number of users connected to atlas
	if(firstConnectionFlag)
	{
		var sum=0;
		for(i in Users)
			if(Users[i].dirname==user.dirname && Users[i].mri.atlas==user.mri.atlas)
				sum++;
		console.log(sum+" users are connected to the atlas "+user.dirname+user.mri.atlas);
	}	
}
function sendAtlasToUser(atlasdata)
{
	if(debug)
		console.log(new Date(),"[sendAtlasToUser]");
	zlib.gzip(atlasdata,function(err,atlasdatagz) {
		try {
			socket.send(atlasdatagz, {binary: true, mask: false});
		} catch(e) {
			console.log(new Date(),"ERROR: Can't send atlas data to user");
		}
	});
}
function sendPaintVolumeMessage(msg) {
	if(debug)
		console.log("> sendPaintVolumeMessage()");
	try {
		socket.send(JSON.stringify({"type":"paintvol","data":msg}));
	} catch (ex) {
		console.log("ERROR: Unable to sendPaintVolumeMessage",ex);
	}
}

//========================================================================================
// Load & Save
//========================================================================================
function addAtlas(dirname,atlasname,dim,callback)
{
	if(debug)
		console.log("[add atlas]");

	console.log(new Date(),"Load atlas "+atlasname+" from "+dirname);
	
	var atlas=new Object();

	atlas.name=atlasname;
	atlas.dirname=dirname;
	atlas.dim=dim;
	loadNifti(atlas,callback);	
	Atlases.push(atlas);
	
	atlas.timer=setInterval(function(){saveNifti(atlas)},10*60*1000); // 10 minutes
}
function loadNifti(atlas,callback)
{
	// Load nifty label
	
	var path=localdir+"/"+atlas.dirname+atlas.name;
	var datatype=2;
	var	vox_offset=352;
	
	if(!fs.existsSync(path)) {
		console.log("No atlas with that name. Creating it");
		
/*			92,1,0,0,100,115,114,32,32,32,32,32,32,0,82,79,73,52,109,109,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
			0,0,0,0,114,48,4,0,45,0,54,0,45,0,1,0,0,0,0,0,0,0,109,109,176,0,0,0,0,0,0,0,0,0,0,0,4,0,8,
			0,0,0,0,0,0,0,0,0,128,64,0,0,128,64,0,0,128,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,176,67,
			0,224,66,69,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,103,101,110,
			101,114,97,116,101,100,32,98,121,32,114,116,111,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
			0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,110,
			111,110,101,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,0,0,22,0,30,0,18,0,0,
			0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
			0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 */
/*
To create this buffer, I used an hex editor to dump the 1st 352 bytes of a
nii file, and converted them to decimal using:
gawk 'BEGIN{s="5C 01 ...";split(s,a," ");for(i=1;i<353;i++)printf"%s,",strtonum("0x"a[i])}'
*/
		atlas.hdr=new Buffer([
			92,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,230,0,
			44,1,14,1,1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,8,0,0,0,0,0,128,191,195,245,168,
			62,195,245,168,62,195,245,168,62,0,0,0,0,0,0,128,63,0,0,128,63,0,0,128,63,0,0,176,67,0,0,0,
			0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,70,114,101,101,83,117,
			114,102,101,114,32,77,97,121,32,50,53,32,50,48,49,49,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
			0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
			0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,128,0,0,128,63,0,0,0,0,144,194,93,66,164,112,
			125,194,195,245,40,194,195,245,168,190,0,0,0,128,0,0,0,0,144,194,93,66,0,0,0,128,195,245,168,
			62,0,0,0,128,164,112,125,194,0,0,0,0,0,0,0,0,195,245,168,62,195,245,40,194,0,0,0,0,0,0,0,0,0,
			0,0,0,0,0,0,0,110,43,49,0,0,0,0,0]);
		
		atlas.hdr.writeUInt16LE(datatype,72,2); // datatype 2: unsigned char (8 bits/voxel)
		atlas.data=new Buffer(atlas.dim[0]*atlas.dim[1]*atlas.dim[2]);

		var i,sum=0;
		for(i=0;i<atlas.dim[0]*atlas.dim[1]*atlas.dim[2];i++)
			sum+=atlas.data[i];
		atlas.sum=sum;

		console.log(new Date());
		console.log("size",atlas.data.length);
		console.log("dim",atlas.dim);
		console.log("datatype",datatype);
		console.log("vox_offset",vox_offset);
		console.log("free memory",os.freemem());
		callback(atlas.data);
	} else {
		console.log("Atlas with that name found. Loading it");
		var niigz;
		try {
			niigz=fs.readFileSync(path);
			zlib.gunzip(niigz,function(err,nii) {
				var	sizeof_hdr=nii.readUInt32LE(0);
				var	dimensions=nii.readUInt16LE(40);
				atlas.hdr=nii.slice(0,vox_offset);
				atlas.dim=[];
				atlas.dim[0]=nii.readUInt16LE(42);
				atlas.dim[1]=nii.readUInt16LE(44);
				atlas.dim[2]=nii.readUInt16LE(46);
				datatype=nii.readUInt16LE(72);
				vox_offset=nii.readFloatLE(108);

				atlas.data=nii.slice(vox_offset);

				var i,sum=0;
				for(i=0;i<atlas.dim[0]*atlas.dim[1]*atlas.dim[2];i++)
					sum+=atlas.data[i];
				atlas.sum=sum;

				console.log(new Date());
				console.log("size",atlas.data.length);
				console.log("dim",atlas.dim);
				console.log("datatype",datatype);
				console.log("vox_offset",vox_offset);
				console.log("free memory",os.freemem());
				callback(atlas.data);
			});
		} catch(e) {
			console.log(new Date(),"Error reading atlas data");
		}
	}
}
function saveNifti(atlas)
{
	if(atlas && atlas.dim)
	{
		var i,sum=0;
		for(i=0;i<atlas.dim[0]*atlas.dim[1]*atlas.dim[2];i++)
			sum+=atlas.data[i];
		if(sum==atlas.sum)
		{
			console.log("Atlas",atlas.dirname,atlas.name,
						"no change, no save, freemem",os.freemem());
			return;
		}
		atlas.sum=sum;

		var	voxel_offset=352;
		var	nii=new Buffer(atlas.dim[0]*atlas.dim[1]*atlas.dim[2]+voxel_offset);
		console.log("Atlas",atlas.dirname,atlas.name,
					"data length",atlas.data.length+voxel_offset,
					"buff length",nii.length);
		atlas.hdr.copy(nii);
		atlas.data.copy(nii,voxel_offset);
		zlib.gzip(nii,function(err,niigz) {
			var	ms=+new Date;
			var n1=localdir+atlas.dirname+atlas.name;
			var	n2=localdir+atlas.dirname+ms+"_"+atlas.name;
			fs.rename(n1,n2,function(){
				fs.writeFile(n1,niigz);
			});
		});
	}
	else
		console.log("nope");
}

//========================================================================================
// Undo
//========================================================================================

/* TODO
 UndoStacks should be stored separately for each user, in that way
 when a user leaves, its undo stack is disposed. With the current
 implementation, we'll be storing undo stacks for long gone users...
*/

function pushUndoLayer(user) {
	if(debug)
		console.log("[pushUndoLayer] for user",user.username);
		
	var undoLayer={"user":user,"actions":[]};
	UndoStack.push(undoLayer);

	if(debug)
		console.log("Number of layers",UndoStack.length);
	
	return undoLayer;
}
function getCurrentUndoLayer(user) {
	if(debug)
		console.log("[getCurrentUndoLayer]");
		
	var i,undoLayer,found=false;
	
	for(i=UndoStack.length-1;i>=0;i--) {
		undoLayer=UndoStack[i];
		if(undoLayer==undefined)
			break;
		if(undoLayer.user.username==user.username) {
			found=true;
			break;
		}
	}
	if(!found) {
		// There was no undoLayer for this user. This may be the
		// first user's action. Create an appropriate undoLayer for it. 
		console.log("not found, make it");
		undoLayer=pushUndoLayer(user);
	}	
	return undoLayer;
}
function undo(user) {
	if(debug)
		console.log("[undo]");
		
	var undoLayer;
	var	i,action,found=false;
	
	for(i=UndoStack.length-1;i>=0;i--) {
		undoLayer=UndoStack[i];
		if(undoLayer==undefined)
			break;
		if(undoLayer.user.username==user.username && undoLayer.actions.length>0) {
			found=true;
			UndoStack.splice(i,1); // remove layer from UndoStack
			console.log("found");
			break;
		}
	}
	if(!found) {
		// There was no undoLayer for this user.
		console.log("No more undo layers for user "+user.username);
		return;
	}
	
	/*
		undoLayer.actions is a sparse array, with many undefined values.
		Here I take each of the values in actions, and add them to arr.
		Each element of arr is an array of 2 elements, index and value.
	*/
	var arr=[];
	var msg;
	var	vol=Atlases[user.iAtlas].data;
	var val;

	for(i in undoLayer.actions) {
		val=undoLayer.actions[i];
		arr.push([i,val]);

	    // The actual undo having place:
	    vol[i]-=val;
	}
	msg={"data":arr};
	sendPaintVolumeMessage(JSON.stringify(msg));

	console.log(UndoStack.length+" undo layers remaining (all users)");	
}
//========================================================================================
// Painting
//========================================================================================
function paintxy(u,c,x,y,user,undoLayer)
/*
	From 'user' we know slice, atlas, vol, view, dim
*/
{
	if(Atlases[user.iAtlas].data==undefined) {
		console.log(new Date(),"ERROR: No atlas to draw into");
		return;
	}
	
	var coord={"x":x,"y":y,"z":user.slice};
	if(user.x0<0) {
		user.x0=coord.x;
		user.y0=coord.y;
	}
	
	switch(c)
	{
		case 'le': // Line, erasing
			line(coord.x,coord.y,0,user,undoLayer);
			break;
		case 'lf': // Line, painting
			line(coord.x,coord.y,1,user,undoLayer);
			break;
		case 'f': // Fill, painting
			fill(coord.x,coord.y,coord.z,1,user,undoLayer);
			//pushUndoLayer(user);
			break;
		case 'e': // Fill, erasing
			fill(coord.x,coord.y,coord.z,0,user,undoLayer);
			//pushUndoLayer(user);
			break;
		case 'mu': // Mouse up (touch ended)
			console.log("mu!");
			pushUndoLayer(user);
			break;
		case 'u':
			undo(user);
			break;
	}
	user.x0=coord.x;
	user.y0=coord.y;
}
function paintVoxel(mx,my,mz,user,vol,val,undoLayer) {
	var	myView=user.view;
	var	dim=Atlases[user.iAtlas].dim;
	var	x,y,z;
	var	i=-1;
	switch(myView)
	{	case 'sag':	x=mz; y=mx; z=my;break; // sagital
		case 'cor':	x=mx; y=mz; z=my;break; // coronal
		case 'axi':	x=mx; y=my; z=mz;break; // axial
	}	
	if(z>=0&&z<dim[2]&&y>=0&&y<dim[1]&&x>=0&&x<dim[0])
		i=z*dim[1]*dim[0]+y*dim[0]+x;
	if(vol[i]!=val) {
		undoLayer.actions[i]=val-vol[i];
		vol[i]=val;
	}
}
function sliceXYZ2index(mx,my,mz,user)
{
	var	myView=user.view;
	var	dim=Atlases[user.iAtlas].dim;
	var	x,y,z;
	var	i=-1;
	switch(myView)
	{	case 'sag':	x=mz; y=mx; z=my;break; // sagital
		case 'cor':	x=mx; y=mz; z=my;break; // coronal
		case 'axi':	x=mx; y=my; z=mz;break; // axial
	}	
	if(z>=0&&z<dim[2]&&y>=0&&y<dim[1]&&x>=0&&x<dim[0])
		i=z*dim[1]*dim[0]+y*dim[0]+x;
	return i;
}
function line(x,y,val,user,undoLayer)
{
	// Bresenham's line algorithm adapted from
	// http://stackoverflow.com/questions/4672279/bresenham-algorithm-in-javascript

	//console.log("line user",user);

	var	vol=Atlases[user.iAtlas].data;
	var	dim=Atlases[user.iAtlas].dim;
	var	x1=user.x0;
	var y1=user.y0;
	var	z=user.slice;
	var x2=x;
	var y2=y;
	var	i;

    // Define differences and error check
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    var sx = (x1 < x2) ? 1 : -1;
    var sy = (y1 < y2) ? 1 : -1;
    var err = dx - dy;

	for(j=0;j<user.penSize;j++)
	for(k=0;k<user.penSize;k++)
	    paintVoxel(x1+j,y1+k,z,user,vol,val,undoLayer);
    
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
		for(j=0;j<user.penSize;j++)
		for(k=0;k<user.penSize;k++)
			paintVoxel(x1+j,y1+k,z,user,vol,val,undoLayer);
	}
}
function fill(x,y,z,val,user,undoLayer)
{
	var view=user.view;
	var	vol=Atlases[user.iAtlas].data;
	var dim=Atlases[user.iAtlas].dim;
	var	Q=[],n;
	var	i;
		
	Q.push({"x":x,"y":y});
	while(Q.length>0)
	{
		n=Q.pop();
		x=n.x;
		y=n.y;
		if(vol[sliceXYZ2index(x,y,z,user)]!=val)
		{
			paintVoxel(x,y,z,user,vol,val,undoLayer);
			
			i=sliceXYZ2index(x-1,y,z,user);
			if(i>=0 && vol[i]!=val)
				Q.push({"x":x-1,"y":y});
			
			i=sliceXYZ2index(x+1,y,z,user);
			if(i>=0 && vol[i]!=val)
				Q.push({"x":x+1,"y":y});
			
			i=sliceXYZ2index(x,y-1,z,user);
			if(i>=0 && vol[i]!=val)
				Q.push({"x":x,"y":y-1});
			
			i=sliceXYZ2index(x,y+1,z,user);
			if(i>=0 && vol[i]!=val)
				Q.push({"x":x,"y":y+1});
		}
	}
}

/*
	atlas
		.name:		string
		.dirname:	string
		.hdr:		Analyze hdr
		.dim[3]:	3 uint16s
		.data:		Analyze img
		.sum:		value sum
	
	user
		.dirname:	string, atlas file directory
		.mri
			.atlas:	string, atlas file name
		.iAtlas:	index of atlas in Atlases[]
		.x0
		.y0
		.slice
		.penSize
		.view

	undoBuffer
		.type:	line, slice, volume
		.data:
*/
