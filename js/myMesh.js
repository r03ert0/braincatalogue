var container;
var camera;
var	tb;
var	scene;
var	renderer;
var	composer;
var	depthMaterial;
var	depthTarget;

function init_mesh(specimen,progress,elem)
{
	console.log('init_mesh',specimen,progress,elem);
	
	var	width, height;

	container = elem;
	width=container.clientWidth;
	height=width;//container.clientHeight;
	console.log(width,height);
	
	camera = new THREE.PerspectiveCamera(25,width/height,10,1000 );
	camera.position.z = 200;
	tb = new THREE.TrackballControls(camera,container);
	tb.autoRotate=true;
	tb.noZoom=true;
	tb.noPan=true;
	tb.addEventListener( 'change', render );

	scene = new THREE.Scene();

	/* ------------------------
	    Load mesh (ply format)
	   ------------------------ */
	var path="/data/"+specimen+'/mesh.ply';
	var oReq = new XMLHttpRequest();
	oReq.open("GET", path, true);
	oReq.addEventListener("progress", function(e){progress.html("Loading Surface ("+parseInt(100*e.loaded/e.total)+"%)")}, false);
	//oReq.addEventListener("progress", function(e){$("#loadProgress").html(parseInt(100*e.loaded/e.total)+"%")}, false);
	oReq.responseType="text";
	oReq.onload = function(oEvent)
	{
		console.log("surface finished loading");
		var tmp=this.response;
		var geometry=new THREE.PLYLoader().parse(tmp);
		geometry.sourceType = "ply";
		var	mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffffff}));
		mesh.name = specimen;
		scene.add(mesh);
		progress.html("<a class='download' href='/data/"+specimen+"/mesh.ply'><img src='/img/download.svg' style='vertical-align:middle;margin-bottom:5px'/></a>Surface");
		animate();
	};
	oReq.send();
	progress.html("<span id='loader'><div class='dot'></div></span> Loading Surface...");
	console.log("surface started loading");

	/* ---------------
	    Init renderer
	   --------------- */
	if(webglAvailable()) {
		renderer=new THREE.WebGLRenderer({alpha:true});
	}
	else {
		renderer=new THREE.CanvasRenderer({alpha:true});
	}
	renderer.setSize(width,height);
	renderer.setClearColor(0x000000,0);
	container.appendChild(renderer.domElement);

	/* --------------
	    Depth shader
	   -------------- */
	var depthShader = THREE.ShaderLib[ "depthRGBA" ];
	var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );
	depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
	depthMaterial.blending = THREE.NoBlending;

	/* -------------------
	    AO postprocessing
	   ------------------- */
	composer = new THREE.EffectComposer( renderer );
	composer.addPass( new THREE.RenderPass( scene, camera ) );
	depthTarget = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
	var effect = new THREE.ShaderPass( THREE.SSAOShader );
	effect.uniforms['tDepth'].value = depthTarget;
	effect.uniforms['size'].value.set( width, height );
	effect.uniforms['cameraNear'].value = camera.near;
	effect.uniforms['cameraFar'].value = camera.far;
	effect.uniforms['lumInfluence'].value = 0.5;
	//effect.uniforms['aoClamp'].value = 0.9;
	effect.renderToScreen = true;
	composer.addPass( effect );

	window.addEventListener('resize',onWindowResize,false);
}
function webglAvailable() {
    try {
        var canvas = document.createElement("canvas");
        return !!
            window.WebGLRenderingContext && 
            (canvas.getContext("webgl") || 
                canvas.getContext("experimental-webgl"));
    } catch(e) { 
        return false;
    } 
}
function onWindowResize() {

	var width=container.clientWidth;
	var height=width; //container.clientHeight;
	container.clientHeight=width;

	camera.aspect = width/height;
	camera.updateProjectionMatrix();
	renderer.setSize( width,height );
	tb.handleResize();
}
function render() {
	scene.overrideMaterial = depthMaterial;
	renderer.render(scene,camera,depthTarget);
	scene.overrideMaterial = null;
	composer.render();
}
function animate(){
	requestAnimationFrame(animate);
	tb.update();
	render();
}
