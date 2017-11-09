var MyMeshViewer = {
	debug:		0,
	container:	null,
	camera:		null,
	tb:			null,
	scene:		null,
	renderer:	null,
	composer:	null,
	depthMaterial:	null,
	depthTarget:	null,
	init_mesh: function(specimen,progress,elem) {
		var me=MyMeshViewer;
		if(me.debug)
			console.log('init_mesh',specimen,progress,elem);
	
		var	width, height;

		me.container = elem;
		width=me.container.clientWidth;
		height=width;
		if(me.debug)
			console.log(width,height);
	
		me.camera = new THREE.PerspectiveCamera(25,width/height,10,1000 );
		me.camera.position.z = 200;
		me.tb = new THREE.TrackballControls(me.camera,me.container);
		me.tb.autoRotate=true;
		me.tb.noZoom=true;
		me.tb.noPan=true;
		me.tb.addEventListener( 'change', me.render );

		me.scene = new THREE.Scene();

		/* ------------------------
			Load mesh (ply format)
		   ------------------------ */
		var path="/data/"+specimen+'/mesh.ply';
		var oReq = new XMLHttpRequest();
		oReq.addEventListener("progress", function(e){
			if(e.lengthComputable)
				progress.html(parseInt(100*e.loaded/e.total)+"% Loaded");
			else
				progress.html("Loading Surface...");
		}, false);
		oReq.open("GET", path, true);
		oReq.responseType="text";
		oReq.onload = function(oEvent)
		{
			console.log("surface finished loading");
			var tmp=this.response;
			var geometry=new THREE.PLYLoader().parse(tmp);
			geometry.sourceType = "ply";
			var	mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffffff}));
			mesh.name = specimen;
			me.scene.add(mesh);
			progress.html("<a class='download' href='/data/"+specimen+"/mesh.ply'><img src='/img/download.svg' style='vertical-align:middle;margin-bottom:5px'/>Surface</a>");
			me.animate();
		};
		oReq.send();
		progress.html("<span id='loader'><div class='dot'></div></span> Loading Surface...");
		console.log("surface started loading");

		/* ---------------
			Init renderer
		   --------------- */
		if(me.webglAvailable()) {
			me.renderer=new THREE.WebGLRenderer({alpha:true});
		}
		else {
			me.renderer=new THREE.CanvasRenderer({alpha:true});
		}
		me.renderer.setSize(width,height);
		me.renderer.setClearColor(0x000000,0);
		me.container.appendChild(me.renderer.domElement);

		/* --------------
			Depth shader
		   -------------- */
		var depthShader = THREE.ShaderLib[ "depthRGBA" ];
		var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );
		me.depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
		me.depthMaterial.blending = THREE.NoBlending;

		/* -------------------
			AO postprocessing
		   ------------------- */
		me.composer = new THREE.EffectComposer( me.renderer );
		me.composer.addPass( new THREE.RenderPass( me.scene, me.camera ) );
		me.depthTarget = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );
		var effect = new THREE.ShaderPass( THREE.SSAOShader );
		effect.uniforms['tDepth'].value = me.depthTarget;
		effect.uniforms['size'].value.set( width, height );
		effect.uniforms['cameraNear'].value = me.camera.near;
		effect.uniforms['cameraFar'].value = me.camera.far;
		effect.uniforms['lumInfluence'].value = 0.5;
		//effect.uniforms['aoClamp'].value = 0.9;
		effect.renderToScreen = true;
		me.composer.addPass( effect );

		window.addEventListener('resize',me.onWindowResize,false);
	},
	webglAvailable: function () {
		var me=MyMeshViewer;
		try {
			var canvas = document.createElement("canvas");
			return !!
				window.WebGLRenderingContext && 
				(canvas.getContext("webgl") || 
					canvas.getContext("experimental-webgl"));
		} catch(e) { 
			return false;
		} 
	},
	onWindowResize: function() {
		var me=MyMeshViewer;

		var width=me.container.clientWidth;
		var height=width; //me.container.clientHeight;
		me.container.clientHeight=width;

		me.camera.aspect = width/height;
		me.camera.updateProjectionMatrix();
		me.renderer.setSize( width,height );
		me.tb.handleResize();
	},
	render: function () {
		var me=MyMeshViewer;
		me.scene.overrideMaterial = me.depthMaterial;
		me.renderer.render(me.scene,me.camera,me.depthTarget);
		me.scene.overrideMaterial = null;
		if(me.composer)
			me.composer.render();
	},
	animate: function() {
		var me=MyMeshViewer;
		requestAnimationFrame(me.animate);
		me.tb.update();
		me.render();
	}
}