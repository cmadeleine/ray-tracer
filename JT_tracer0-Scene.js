//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings,
//  lets me see EXACTLY what the editor's 'line-wrap' feature will do.)

//===  JT_tracer0-Scene.js  ===================================================
// The object prototypes here and in related files (and their comments):
//      JT_tracer1-Camera.js
//      JT_tracer2-Geom.js
//      JT_tracer3-ImgBuf.js
// are suitable for any and all features described in the Ray-Tracing Project 
// Assignment Sheet for EECS 351-2 Intermediate Computer Graphics.
//
// HOWEVER, they're not required, nor even particularly good:
//				(notably awkward style from their obvious C/C++ origins) 
// They're here to help you get 'started' on better code of your own,
// and to help you avoid common structural 'traps' in writing ray-tracers
//		that might otherwise force ugly/messy refactoring later, such as:
//  --lack of a well-polished vector/matrix library; e.g. open-src glmatrix.js
//  --lack of floating-point RGB values to compute light transport accurately,
//	--no distinct 'camera' and 'image' objects or 'trace' and 'display' funcs to 
// 		separate slow ray-tracing steps from fast screen-display and refresh.
//	--lack of ray-trace image-buffer (window re-size would discard your work!) 
//  --lack of texture-mapped image display; permits ray-traced image of any 
//		resolution to display on any screen at any desired image size
//	--ability to easily match OpenGL/WebGL functions with ray-tracing results, 
//		using identically-matching ray-tracing functions for cameras, views, 
//		transformations, lighting, and materials (e.g. rayFrustum(), rayLookAt(); 
//		rayTranlate(), rayRotate(), rayScale()...)
//  --a straightforward method to implement scene graphs & jointed objects. 
//		Do it by transforming world-space rays to model coordinates, rather than 
//		models to world coords, using a 4x4 worl2model matrix stored in each 
//		model (each CGeom primitive).  Set it by OpenGL-like functions 
//		rayTranslate(), rayRotate(), rayScale(), etc.
//  --the need to describe geometry/shape independently from surface materials,
//		and to select material(s) for each shape from a list of materials;
//  --materials that permit procedural 3D textures, turbulence & Perlin Noise,  
//	--objects for independent light sources, ones that can inherit their 
//    location(s) from a geometric shape (e.g. a light-bulb shape).
//  --need to create a sortable LIST of ray/object hit-points, and not just
//		the intersection nearest to the eyepoint, to enable shape-creation by
//		Constructive Solid Geometry (CSG), alpha-blending, & ray root-finding.
//  --functions organized well to permit easy recursive ray-tracing:  don't 
//		tangle together ray/object intersection-finding tasks with shading, 
//		lighting, and materials-describing tasks.(e.g. traceRay(), findShade() )

/*
-----------ORGANIZATION:-----------
I recommend using just one or two global top-level objects (put above main() )
  g_myPic == new CImgBuf(512,512);  // your 'image buffer' object to hold 
                                    // a floating-point ray-traced image, and
	g_myScene = new CScene();         // your ray-tracer, which can fill any
	                                  // CImgBuf 'image buffer' you give to it.
	g_myScene.setImgBuf(g_myPic);     // Sets ray-tracers destination. 
	g_myScene.initScene(num);         // Sets up selected 3D scene for ray-tracer;
	                                  // Ready to trace!
		
One CScene object contains all parts of our ray-tracer: 
  its camera (CCamera) object, 
  its collection of 3D shapes (CGeom), 
  its collection of light sources (CLight), 
  its collection of materials (CMatl), and more.  
When users press the 'T' or 't' key (see GUIbox method gui.keyPress() ), 
  the program starts ray-tracing:
  -- it calls the CScene method 'MakeRayTracedImage()'. This top-level function 
  fills each pixel of the CImgBuf object (e.g. g_myPic) that was set as its
  'destination' by calling the CScene.setImgBuf() function.
  This 'makeRayRacedImage() function orchestrates creation and recursive tracing 
  of millions of rays to find the on-screen color of each pixel in the CImgBuf
  object set as its destination (g_myPic).
  The CScene object also contains & uses:
		--CRay	== a 3D ray object in an unspecified coord. system (usually 'world').
		--CCamera == ray-tracing camera object defined the 'world' coordinate system.
		--CGeom	== a 3D geometric shape object for ray-tracing (implicit function).
		  The 'item[]' array holds all CGeom objects for a scene.
		--i == an object that describes how 1 ray pierced the surface of 1 shape; 
		--CHitList == an object that holds an array of all CHit objects found for
		   1 ray traced thru entire CScene. (Later ray-tracer versions have multiple
		   CHitList objects due to recursive ray-tracing.  One CHitList object for 
		   the eyeRay; another for rays recursively-traced from eye-ray hit-points,
		   such as rays for shadow, reflection, transparency, etc.)
*/

//----------------------------------------------------------------------------
// NOTE: JavaScript has no 'class-defining' statements or declarations: instead
// we simply create a new object type by defining its constructor function, and
// add member methods/functions using JavaScript's 'prototype' feature.
// SEE: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/prototype 
//----------------------------------------------------------------------------

var g_t0_MAX = 1.23E12;  // 'sky' distance; approx. farthest-possible hit-point.

function CHit() {
//=============================================================================
// Describes one ray/object intersection point that was found by 'tracing' one
// ray through one shape (through a single CGeom object, held in the
// CScene.item[] array).
// CAREFUL! We don't use isolated CHit objects, but instead gather all the CHit
// objects for one ray in one list held inside a CHitList object.
// (CHit, CHitList classes are consistent with the 'HitInfo' and 'Intersection'
// classes described in FS Hill, pg 746).

    this.hitGeom = null;        // (reference to)the CGeom object we pierced in
                                //  in the CScene.item[] array (null if 'none').
                                // NOTE: CGeom objects describe their own
                                // materials and coloring (e.g. CMatl).
// TEMPORARY: replaces traceGrid(),traceDisk() return value
this.hitNum = -1; // SKY color

    this.t0 = g_t0_MAX;         // 'hit time' parameter for the ray; defines one
                                // 'hit-point' along ray:   orig + t*dir = hitPt.
                                // (default: t set to hit very-distant-sky)
    this.hitPt = vec4.create(); // World-space location where the ray pierced
                                // the surface of a CGeom item.
    this.surfNorm = vec4.create();  // World-space surface-normal vector at the 
                                //  point: perpendicular to surface.
    this.viewN = vec4.create(); // Unit-length vector from hitPt back towards
                                // the origin of the ray we traced.  (VERY
                                // useful for Phong lighting, etc.)
    this.isEntering=true;       // true iff ray origin was OUTSIDE the hitGeom.
                                //(example; transparency rays begin INSIDE).
                                
    this.modelHitPt = vec4.create(); // the 'hit point' in model coordinates.
    // *WHY* have modelHitPt? to evaluate procedural textures & materials.
    //      Remember, we define each CGeom objects as simply as possible in its
    // own 'model' coordinate system (e.g. fixed, unit size, axis-aligned, and
    // centered at origin) and each one uses its own worldRay2Model matrix
    // to customize them in world space.  We use that matrix to translate,
    // rotate, scale or otherwise transform the object in world space.
    // This means we must TRANSFORM rays from the camera's 'world' coord. sys.
    // to 'model' coord sys. before we trace the ray.  We find the ray's
    // collision length 't' in model space, but we can use it on the world-
    // space rays to find world-space hit-point as well.
    //      However, some materials and shading methods work best in model
    // coordinates too; for example, if we evaluate procedural textures
    // (grid-planes, checkerboards, 3D woodgrain textures) in the 'model'
    // instead of the 'world' coord system, they'll stay 'glued' to the CGeom
    // object as we move it around in world-space (by changing worldRay2Model
    // matrix), and the object's surface patterns won't change if we 'squeeze' 
    // or 'stretch' it by non-uniform scaling.
    this.colr = vec4.clone(g_myScene.skyColor);   // set default as 'sky'
                                // The final color we computed for this point,
                                // (note-- not used for shadow rays).
                                // (uses RGBA. A==opacity, default A=1=opaque.
}

CHit.prototype.init  = function() {
//==============================================================================
// Set this CHit object to describe a 'sky' ray that hits nothing at all;
// clears away all CHit's previously-stored description of any ray hit-point.
  this.hitGeom = -1;            // (reference to)the CGeom object we pierced in
                                //  in the CScene.item[] array (null if 'none').
this.hitNum = -1; // TEMPORARY:
  // holds traceGrid() or traceDisk() result.

  this.t0 = g_t0_MAX;           // 'hit time' for the ray; defines one
                                // 'hit-point' along ray:   orig + t*dir = hitPt.
                                // (default: giant distance to very-distant-sky)
  vec4.set(this.hitPt, this.t0, 0,0,1); // Hit-point: the World-space location 
                                //  where the ray pierce surface of CGeom item.
  vec4.set(this.surfNorm,-1,0,0,0);  // World-space surface-normal vector 
                                // at the hit-point: perpendicular to surface.
  vec4.set(this.viewN,-1,0,0,0);// Unit-length vector from hitPt back towards
                                // the origin of the ray we traced.  (VERY
                                // useful for Phong lighting, etc.)
  this.isEntering=true;         // true iff ray origin was OUTSIDE the hitGeom.
                                //(example; transparency rays begin INSIDE).                                
  vec4.copy(this.modelHitPt,this.hitPt);// the 'hit point' in model coordinates.
}
 

function CHitList() {
//=============================================================================
// Holds ALL ray/object intersection results from tracing a single ray(CRay)
// sent through ALL shape-defining objects (CGeom) in in the item[] array in 
// our scene (CScene).  A CHitList object ALWAYS holds at least one valid CHit 
// 'hit-point', as we initialize the pierce[0] object to the CScene's 
//  background color.  Otherwise, each CHit element in the 'pierce[]' array
// describes one point on the ray where it enters or leaves a CGeom object.
// (each point is in front of the ray, not behind it; t>0).
//  -- 'iEnd' index selects the next available CHit object at the end of
//      our current list in the pierce[] array. if iEnd=0, the list is empty.
//  -- 'iNearest' index selects the CHit object nearest the ray's origin point.
	//
	//
	//
	//
	//  	YOU WRITE THIS!  
	//
	//
	//
	//
	//
}



function CScene() {
//=============================================================================
// This is a complete ray tracer object prototype (formerly a C/C++ 'class').
//      My code uses just one CScene instance (g_myScene) to describe the entire 
//			ray tracer.  Note that I could add more CScene objects to make multiple
//			ray tracers (perhaps run on different threads or processors) and then 
//			combine their results into a giant video sequence, a giant image, or 
//			use one ray-traced result as input to make the next ray-traced result.
//
//The CScene prototype includes:
// One CImgBuf object 'imgBuf' used to hold ray-traced result image.
//      (see CScene.setImgBuf() method below)
// One CCamera object that describes an antialiased ray-tracing camera;
//      in my code, it is the 'rayCam' variable within the CScene prototype.
//      The CCamera class defines the SOURCE of rays we trace from our eyepoint
//      into the scene, and uses those rays to set output image pixel values.
// One CRay object 'eyeRay' that describes the ray we're currently tracing from
//      eyepoint into the scene.
// a COLLECTION of CGeom objects: each describe an individual visible thing; a
//      single item or thing we may see in the scene.  That collection is the 
//			held in the 'item[]' array within the CScene class.
//      		Each CGeom element in the 'item[]' array holds one shape on-screen.
//      To see three spheres and a ground-plane we'll have 4 CGeom objects, one 
//			for each of the spheres, and one for the ground-plane.
//      Each CGeom obj. includes a 'matlIndex' index number that selects which
//      material to use in rendering the CGeom shape. I assume ALL lights in a
//      scene may affect ALL CGeom shapes, but you may wish to add an light-src
//      index to permit each CGeom object to choose which lights(s) affect it.
// One CHitList object 'eyeHits' that describes each 3D point where 'eyeRay'
//      pierces a shape (a CGeom object) in our CScene.  Each CHitList object
//      in our ray-tracer holds a COLLECTION of hit-points (CHit objects) for a
//      ray, and keeps track of which hit-point is closest to the camera. That
//			collection is held in the eyeHits member of the CScene class.
// a COLLECTION of CMatl objects; each describes one light-modifying material'
//      hold this collection in  'matter[]' array within the CScene class).
//      Each CMatl element in the 'matter[]' array describes one particular
//      individual material we will use for one or more CGeom shapes. We may
//      have one CMatl object that describes clear glass, another for a
//      Phong-shaded brass-metal material, another for a texture-map, another
//      for a bump mapped material for the surface of an orange (fruit),
//      another for a marble-like material defined by Perlin noise, etc.
// a COLLECTION of CLight objects that each describe one light source.  
//			That collection is held in the 'lamp[]' array within the CScene class.
//      Note that I apply all lights to all CGeom objects.  You may wish to add
//      an index to the CGeom class to select which lights affect each item.
//
// The default CScene constructor creates a simple scene that will create 
// picture if traced:
// --rayCam with +/- 45 degree Horiz field of view, aimed in the -Z direcion 
// 			from the world-space location (0,0,0),
// --item[0] is a ground-plane grid at z= -5.
//
//  Calling 'initScene()' lets you choose other scenes, such as:
//  --our 'rayCam' camera at (5,5,5) aimed at the origin;
//  --item[0] shape, a unit sphere at the origin that uses matter[0] material;
//  --matter[0] material is a shiny red Phong-lit material, lit by lamp[0];
//  --lamp[0] is a point-light source at location (5,5,5).


  this.RAY_EPSILON = 1.0E-10;       // ray-tracer precision limits; treat 
                                    // any value smaller than this as zero.
                                    // (why?  JS uses 52-bit mantissa;
                                    // 2^-52 = 2.22E-16, so what is a good
                                    // safety margin for small# calcs? Test it!)
                                    
  this.imgBuf = g_myPic;            // DEFAULT output image buffer
                                    // (change it with setImgBuf() if needed)
  this.eyeRay = new CRay();	        // the ray from the camera for each pixel
  this.rayCam = new CCamera();	    // the 3D camera that sets eyeRay values:
                                    // this is the DEFAULT camera (256,256).
                                    // (change it with setImgBuf() if needed)
  this.item = [];                   // this JavaScript array holds all the
                                    // CGeom objects of the  current scene.
  this.lamp = [];                   // array of light objects
  this.Ia = vec4.fromValues(0.0, 0.0, 0.0, 1.0); // Ambient illumination for all objects/lights
  this.recursion = 0;
}

CScene.prototype.setImgBuf = function(nuImg) {
//==============================================================================
// set/change the CImgBuf object we will fill with our ray-traced image.
// This is USUALLY the global 'g_myPic', but could be any CImgBuf of any
// size.  

  // Re-adjust ALL the CScene methods/members affected by output image size:
  this.rayCam.setSize(nuImg.xSiz, nuImg.ySiz);
  this.imgBuf = nuImg;    // set our ray-tracing image destination.
}

CScene.prototype.initScene = function(num) {
//==============================================================================
// Initialize our ray tracer, including camera-settings, output image buffer
// to use.  Then create a complete 3D scene (CGeom objects, materials, lights, 
// camera, etc) for viewing in both the ray-tracer **AND** the WebGL previewer.
// num == 0: basic ground-plane grid;
//     == 1: ground-plane grid + round 'disc' object;
//     == 2: ground-plane grid + sphere
//     == 3: ground-plane grid + sphere + 3rd shape, etc.

  if(num == undefined) num = 0;   // (in case setScene() called with no arg.)
  // Set up ray-tracing camera to use all the same camera parameters that
  // determine the WebGL preview.  GUIbox fcns can change these, so be sure
  // to update these again just before you ray-trace:
  this.rayCam.rayPerspective(gui.camFovy, gui.camAspect, gui.camNear);
  this.rayCam.rayLookAt(gui.camEyePt, gui.camAimPt, gui.camUpVec);
  this.setImgBuf(g_myPic);    // rendering target: our global CImgBuf object
                              // declared just above main().
  // Set default sky color:
  this.skyColor = vec4.fromValues( 0.4,0.4,0.6,1.0);  // cyan/bright blue
  // Empty the 'item[] array -- discard all leftover CGeom objects it may hold.
  this.item.length = 0;     
  this.lamp.length = 0;  
  var iNow = 0;         // index of the last CGeom object put into item[] array
  
  // set up new scene:
  switch(num) {
    case 0:     // (default scene number; must create a 3D scene for ray-tracing
      // create our list of CGeom shapes that fill our 3D scene:
      //---Ground Plane-----
      // draw this in world-space; no transforms!
      this.item.push(new CGeom(RT_GNDPLANE));   // Append gnd-plane to item[] array
      iNow = this.item.length -1;               // get its array index.
                                                // use default colors.
                                                // no transforms needed.
      this.item[iNow].material.setMatl(MATL_DEFAULT);   


      // SCENE 1
      //-----Sphere 1-----
      this.item.push(new CGeom(RT_SPHERE));       // Append sphere to item[] &
      iNow = this.item.length -1;                 // get its array index.
      // Initially leave sphere at the origin. Once you see it, then
      // move it to a more-sensible location:
      // other stuff
      this.item[iNow].material.setMatl(MATL_RED_PLASTIC);
  	  this.item[iNow].setIdent();                   // start in world coord axes
      this.item[iNow].rayTranslate(0,-6, 1.0);  // move rightwards (+x),
      // and toward camera (-y) enough to stay clear of disks, and up by 1 to
      // make this radius==1 sphere rest on gnd-plane.
      
     
      //-----Sphere 2-----
      this.item.push(new CGeom(RT_SPHERE));       // Append sphere to item[] &
      iNow = this.item.length -1;                 // get its array index.
      // Initially leave sphere at the origin. Once you see it, then
      // move it to a more-sensible location:
      // other stuff
      this.item[iNow].material.setMatl(MATL_MIRROR);
  	  this.item[iNow].setIdent();                   // start in world coord axes
      this.item[iNow].rayTranslate(0 , -10, 1.0);  // move rightwards (+x),
      // and toward camera (-y) enough to stay clear of disks, and up by 1 to
      // make this radius==1 sphere rest on gnd-plane.

      //-----Sphere 1-----
      this.item.push(new CGeom(RT_SPHERE));       // Append sphere to item[] &
      iNow = this.item.length -1;                 // get its array index.
      // Initially leave sphere at the origin. Once you see it, then
      // move it to a more-sensible location:
      // other stuff
      this.item[iNow].material.setMatl(MATL_GRN_PLASTIC);
  	  this.item[iNow].setIdent();                   // start in world coord axes
      this.item[iNow].rayTranslate(4,-6, 1.0);  // move rightwards (+x),
      // and toward camera (-y) enough to stay clear of disks, and up by 1 to
      // make this radius==1 sphere rest on gnd-plane.


      /*
      //-----Cone 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_RUBY);
      this.item[iNow].setIdent();                   
      //this.item[iNow].rayScale(1.0, 1.0, 2.0); 
      //this.item[iNow].rayTranslate(0.0,0.0, 1.0); 
      //this.item[iNow].rayRotate(2*Math.PI/4, 0, 1, 0);
      this.item[iNow].rayTranslate(0.0,0.0, 1.0); 
      */
      //-----Lamp default------ // WHITE
      this.lamp.push(new CGeom(LAMP));         // Append 2D disk to item[] &
      iNow = this.lamp.length -1;                 // get its array index.
      // set up distinctive coloring:
      vec4.set(this.lamp[iNow].pos, 5.0, -10.0, 10.0,1.0);  
      vec4.set(this.lamp[iNow].Ia, 0.4, 0.4, 0.4, 1.0);
      vec4.set(this.lamp[iNow].Id, 0.5, 0.5, 0.5, 1.0);
      vec4.set(this.lamp[iNow].Is, 0.8, 0.8, 0.8, 1.0);
      this.lamp[iNow].on = false;
  
      
      
      //-----Lamp 1------ // PINK -Y
      this.lamp.push(new CGeom(LAMP));         // Append 2D disk to item[] &
      iNow = this.lamp.length -1;                 // get its array index.
      // set up distinctive coloring:
      vec4.set(this.lamp[iNow].pos, 0, 5.0, 10.0,1.0);  // yellow
      vec4.set(this.lamp[iNow].Ia, 0.4, 0.1, 0.2, 1.0);
      vec4.set(this.lamp[iNow].Id, 1.0, 0.0, 0.5, 1.0);
      vec4.set(this.lamp[iNow].Is, 0.8, 0.8, 0.8, 1.0);
      this.lamp[iNow].on = false;
      
  	 
      
      //-----Lamp 2------ BLUE +Y
      this.lamp.push(new CGeom(LAMP));         // Append 2D disk to item[] &
      iNow = this.lamp.length -1;                 // get its array index.
      // set up distinctive coloring:
      vec4.set(this.lamp[iNow].pos, 3, 14.0, 10.0,1.0);  
      vec4.set(this.lamp[iNow].Ia, 0.0, 0.1, 0.3, 1.0);
      vec4.set(this.lamp[iNow].Id, 0.3, 0.3, 1.0, 1.0);
      vec4.set(this.lamp[iNow].Is, 0.8, 0.8, 0.8, 1.0);
      this.lamp[iNow].on = false;

      //-----Lamp default------ // WHITE
      this.lamp.push(new CGeom(LAMP));         // Append 2D disk to item[] &
      iNow = this.lamp.length -1;                 // get its array index.
      // set up distinctive coloring:
      vec4.set(this.lamp[iNow].pos, 4.0, 0.0, 10.0,1.0);  
      vec4.set(this.lamp[iNow].Ia, 0.4, 0.4, 0.4, 1.0);
      vec4.set(this.lamp[iNow].Id, 0.8, 0.8, 1.0, 1.0);
      vec4.set(this.lamp[iNow].Is, 0.8, 0.8, 0.8, 1.0);
      //this.lamp[iNow].on = false;
      
      
      //================SNOWMAN==============================
      //-----Sphere 1-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_SNOW);
  	  this.item[iNow].setIdent();          
      this.item[iNow].rayTranslate(0.0,10.0, 1.0); 
      //-----Sphere 2-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_SNOW);
  	  this.item[iNow].setIdent();         
      this.item[iNow].rayTranslate(0.0,10.0, 2.25); 
      this.item[iNow].rayScale(0.75, 0.75, 0.75);  
      //-----Sphere 3-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_SNOW);
  	  this.item[iNow].setIdent();          
      this.item[iNow].rayTranslate(0.0,10.0, 3.25); 
      this.item[iNow].rayScale(0.56, 0.56, 0.56); 
      //-----Eye 1-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();       
      this.item[iNow].rayTranslate(0.5, 10.25, 3.4); 
      this.item[iNow].rayScale(0.07, 0.07, 0.07); 
      //-----Eye 2-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();   
      this.item[iNow].rayTranslate(0.5,9.75, 3.4); 
      this.item[iNow].rayScale(0.07, 0.07, 0.07); 
      //-----Cone 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_COPPER_DULL);
      this.item[iNow].setIdent();                 
      this.item[iNow].rayTranslate(1.0, 10.0, 3.25); 
      this.item[iNow].rayRotate(Math.PI/2, 0, 1, 0); 
      this.item[iNow].rayScale(0.1, 0.1, 0.5); 


      //================PERSON==============================
      //-----Cone 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_PINK);
      this.item[iNow].setIdent();   
      this.item[iNow].rayScale(1.0, 1.0, 2.0);                
      this.item[iNow].rayTranslate(0.0,0.0, 1.5); 
      //-----leg 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_OBSIDIAN);
      this.item[iNow].setIdent();                   
      this.item[iNow].rayScale(0.25, 0.25, 2.0);
      this.item[iNow].rayTranslate(0.0, -1, 1.0); 
      //-----leg 2-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_OBSIDIAN);
      this.item[iNow].setIdent();                   
      this.item[iNow].rayScale(0.25, 0.25, 2.0);
      this.item[iNow].rayTranslate(0.0, 1, 1.0); 
      //-----foot 1-----
      this.item.push(new CGeom(RT_SPHERE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_PINK);
      this.item[iNow].setIdent();                   
      this.item[iNow].rayScale(0.35, 0.25, 0.25);
      this.item[iNow].rayTranslate(0.05, -1, 0.25); 
      //-----foot 1-----
      this.item.push(new CGeom(RT_SPHERE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_PINK);
      this.item[iNow].setIdent();                   
      this.item[iNow].rayScale(0.35, 0.25, 0.25);
      this.item[iNow].rayTranslate(0.05, 1, 0.25); 
      //-----arm 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_OBSIDIAN);
      this.item[iNow].setIdent();   
      this.item[iNow].rayTranslate(0.0, 0, 2.5);
      this.item[iNow].rayRotate(-2*Math.PI/8, 1, 0, 0);
      this.item[iNow].rayScale(0.25, 0.25, 1.3);
      //-----arm 2-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_OBSIDIAN);
      this.item[iNow].setIdent();   
      this.item[iNow].rayTranslate(0.0, 0, 2.5);
      this.item[iNow].rayRotate(2*Math.PI/8, 1, 0, 0);
      this.item[iNow].rayScale(0.25, 0.25, 1.3);
      //-----hand 1-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BRONZE_DULL);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(0.0, 1, 1.5);
      this.item[iNow].rayScale(0.25, 0.25, 0.25);  
      //-----hand 2-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BRONZE_DULL);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(0.0, -1, 1.5);
      this.item[iNow].rayScale(0.25, 0.25, 0.25); 
      //-----head-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BRONZE_DULL);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(0.0,0.0, 2.75);  
      this.item[iNow].rayScale(0.5, 0.5, 0.5);    
      //-----hair 1-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(-0.2, 0, 2.8);  
      this.item[iNow].rayScale(0.6, 0.6, 0.6);  
      //-----hair 2-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(-0.2, -0.5, 2.8);  
      this.item[iNow].rayScale(0.4, 0.4, 0.4); 
      //-----hair 3-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(-0.2, 0.5, 2.8);  
      this.item[iNow].rayScale(0.4, 0.4, 0.4); 
      //-----eye 1-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();           
      this.item[iNow].rayTranslate(0.4, 0.25, 2.8); 
      this.item[iNow].rayScale(0.07, 0.07, 0.07); 
      //-----eye 2-----
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_BLACK_PLASTIC);
  	  this.item[iNow].setIdent();    
      this.item[iNow].rayTranslate(0.4,-0.25, 2.8); 
      this.item[iNow].rayScale(0.07, 0.07, 0.07);
      //-----Cone 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_COPPER_DULL);
      this.item[iNow].setIdent();                  
      this.item[iNow].rayTranslate(0.5,0.0, 2.8); 
      this.item[iNow].rayScale(0.07, 0.07, 0.12); 
       
      //================ICE CREAM==============================
      //-----Cone 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_BRONZE_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0,10.0, 1.0); 
      this.item[iNow].rayRotate(-Math.PI, 0, 1, 0); 
      this.item[iNow].rayScale(1.0, 1.0, 2.0); 
      // Scoop
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_PINK);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(10.0,10.0, 3.5);   
      // Scoop bottom
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_PINK);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(10.0,10.0, 3.3);  
      this.item[iNow].rayScale(1.2, 1.2, 0.5); 
      // Cherry
      this.item.push(new CGeom(RT_SPHERE)); 
      iNow = this.item.length -1;             
      this.item[iNow].material.setMatl(MATL_RUBY);
  	  this.item[iNow].setIdent();  
      this.item[iNow].rayTranslate(10.0,10.0, 4.6);  
      this.item[iNow].rayScale(0.25, 0.25, 0.25);   

      //================CHRISTMAS TREE==============================
      //-----Tree 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_JADE);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 4); 
      this.item[iNow].rayScale(1.5, 1.5, 3); 
      //-----Tree 2-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_JADE);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 4.75); 
      this.item[iNow].rayScale(1.25, 1.25, 2.5);  
      //-----Tree 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_JADE);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 5.5); 
      this.item[iNow].rayScale(1, 1, 2); 
      //-----Base-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_BRONZE_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 2); 
      this.item[iNow].rayScale(0.3, 0.3, 2); 
      //-----carpet-----
      this.item.push(new CGeom(RT_SPHERE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_RUBY);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 0); 
      this.item[iNow].rayScale(2.5, 2.5, 0.2);  
      //-----Cone 1-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_GOLD_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 6.0); 
      this.item[iNow].rayScale(0.25, 0.25, 0.5); 
      //-----Cone 2-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_GOLD_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10, -10.0, 5.5); 
      this.item[iNow].rayRotate(1*2*Math.PI/5, 0, 1, 0); 
      this.item[iNow].rayScale(0.25, 0.25, 0.5);  
      this.item[iNow].rayTranslate(0, 0, 1); 
      //-----Cone 3-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_GOLD_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 5.5); 
      this.item[iNow].rayRotate(2*2*Math.PI/5, 0, 1, 0); 
      this.item[iNow].rayScale(0.25, 0.25, 0.5); 
      this.item[iNow].rayTranslate(0, 0, 1); 
      //-----Cone 4-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_GOLD_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 5.5); 
      this.item[iNow].rayRotate(3*2*Math.PI/5, 0, 1, 0); 
      this.item[iNow].rayScale(0.25, 0.25, 0.5); 
      this.item[iNow].rayTranslate(0, 0, 1); 
      //-----Cone 5-----
      this.item.push(new CGeom(RT_CONE));     
      iNow = this.item.length -1;          
      this.item[iNow].material.setMatl(MATL_GOLD_DULL);
      this.item[iNow].setIdent();      
      this.item[iNow].rayTranslate(10.0, -10.0, 5.5); 
      this.item[iNow].rayRotate(4*2*Math.PI/5, 0, 1, 0); 
      this.item[iNow].rayScale(0.25, 0.25, 0.5); 
      this.item[iNow].rayTranslate(0, 0, 1); 
      
      break;
    case 1:
    //
    //
    // another: SCENE 1 SETUP   
      console.log("JT_tracer0-Scene file: CScene.initScene(",num,") NOT YET IMPLEMENTED.");
      this.initScene(0); // use default scene
    //
    //
      break;
    case 2:
    //
    //
    // another: SCENE 2 SETUP   
      console.log("JT_tracer0-Scene file: CScene.initScene(",num,") NOT YET IMPLEMENTED.");    //
      this.initScene(0); // use default scene
    //
      break;
    default:    // nonsensical 'sceneNum' value?
      console.log("JT_tracer0-Scene file: CScene.initScene(",num,") NOT YET IMPLEMENTED.");
      this.initScene(0);   // init the default scene.
    break;
  }
}

CScene.prototype.makeRayTracedImage = function() {
//==============================================================================
// Create an image by Ray-tracing; fill CImgBuf object  'imgBuf' with result.
// (called when you press 'T' or 't')

//	console.log("You called CScene.makeRayTracedImage!")
  // Update our ray-tracer camera to match the WebGL preview camera:
    this.rayCam.rayPerspective(gui.camFovy, gui.camAspect, gui.camNear);
    this.rayCam.rayLookAt(gui.camEyePt, gui.camAimPt, gui.camUpVec);

    this.setImgBuf(this.imgBuf);  // just in case: this ensures our ray-tracer
                                  // will make an image that exactly fills the
                                  // currently-chosen output-image buffer.
                                  // (usually g_myPic, but could have changed)
                                  
  var colr = vec4.create();	// floating-point RGBA color value
  var colr2 = vec4.create();	// floating-point RGBA color value
  var colrTemp = vec4.create();	// floating-point RGBA color value
	var hit = 0;
	var idx = 0;  // CImgBuf array index(i,j) == (j*this.xSiz + i)*this.pixSiz
  var i,j;      // pixel x,y coordinate (origin at lower left; integer values)
  var k;        // item[] index; selects CGeom object we're currently tracing.
  
  this.pixFlag = 0; // DIAGNOSTIC: g_myScene.pixFlag == 1 at just one pixel
                  // selected below. Ray-tracing functions (e.g. traceGrid(), 
                  // traceDisk()) can use g_)myScene.pixFlag to let you print 
                  // values for JUST ONE ray.
  var myHit = new CHit(); // holds the nearest ray/grid intersection (if any)
                          // found by tracing eyeRay thru all CGeom objects
                          // held in our CScene.item[] array.

  //--------super-sampling and jitter---------------
  var samples = g_AAcode;

  var samplDim = samples*samples
  var samplInc = 1 / samples
           
  for(j=0; j< this.imgBuf.ySiz; j++) {        // for the j-th row of pixels.
  	for(i=0; i< this.imgBuf.xSiz; i++) {	    // and the i-th pixel on that row,

      // default empty color vector
		  vec4.set(colr, 0, 0, 0, 1);

      // looping thru cols of sampled section
		  for (j2=0; j2< samples; j2++) {
        // looping thru rows of sampled section
          for (i2=0; i2< samples; i2++) {
  
          
            // location of ray in subtile i2, j2
            i2loc = (i - 0.5 + samplInc/2 + i2*samplInc);
            j2loc = (j - 0.5 + samplInc/2 + j2*samplInc);
  
          
            // if jittered, adjust loc by random val += sampleInc / 2
            if (g_isJitter) {
              i2loc += (Math.random() - 0.5) * (samplInc / 2);
              j2loc += (Math.random() - 0.5) * (samplInc / 2);
            }


			      this.rayCam.setEyeRay(this.eyeRay,i2loc,j2loc);  // create ray for pixel (i,j)
            // DIAGNOSTIC:------------------------------------
            if(i==this.imgBuf.xSiz/2 && j==this.imgBuf.ySiz/4) { 
              this.pixFlag = 0;                     // pixFlag==1 for JUST ONE pixel
              console.log("CScene.makeRayTracedImage() is at pixel [",i,", ",j,"].",
                          "by the cunning use of flags. (Eddie Izzard)");
              // Eddie Izzard "Dress To Kill"(1998)  
              //    short: https://youtu.be/uEx5G-GOS1k 
              //     long: https://youtu.be/hxQYE3E8dEY 
            }
            else {
              this.pixFlag = 0;
            }//-END DIAGNOSTIC--------------------------------
      
            // Trace a new eyeRay thru all CGeom items: ------------------------------
            myHit.init();     // start by clearing our 'nearest hit-point', and
            myHitList = [];

            // NEW CODE, just one function

            //vec4.sub(this.eyeRay.dir, vec4.fromValues(1, 0, 0, 1), this.eyeRay.orig);
            //vec4.set(this.eyeRay.dir, -1, 0, -1, 0)
            //vec4.normalize(this.eyeRay.dir, this.eyeRay.dir)

            vec4.set(this.Ia, 0.4, 0.4, 0.4, 1.0)
            //vec4.scale(this.Ia, this.Ia, 1/(this.recursion + 1));


            this.traceRay(this.eyeRay, myHit);
           
            vec4.set(colr2, 0, 0, 0, 1);

            this.findShade(this.eyeRay, myHit, colr2);
            vec4.add(colr, colr, colr2);

            
            // RECURSE on mirror surfaces - find reflections
            if (myHit.hitGeom != -1 && 
                (myHit.hitGeom.material.K_name == "MATL_MIRROR" || myHit.hitGeom.material.K_name == "MATL_GRN_PLASTIC")) {

                var plastic = myHit.hitGeom.material.K_name == "MATL_GRN_PLASTIC";

              var Ks = vec4.create();
              vec4.copy(Ks, myHit.hitGeom.material.K_spec);

              for (let r = 0; r < this.recursion; r++) {

                vec4.copy(this.eyeRay.orig, myHit.hitPt);
                vec4.copy(this.eyeRay.dir, myHit.surfNorm);

                myHit.init();
                this.traceRay(this.eyeRay, myHit);

                vec4.set(colr2, 0, 0, 0, 1);

                this.findShade(this.eyeRay, myHit, colr2);

                vec4.scale(colr2, colr2, 1/Math.pow(2, r));

                // duller reflection on plastic ball
                if (plastic) {
                  vec4.scale(colr2, colr2, 0.2);
                }

                vec4.add(colr, colr, colr2);
   
              }
            }  
          }
      }

      // finish averaging colors for super-sampling
      colr[0] = colr[0] / samplDim;
      colr[1] = colr[1] / samplDim;
      colr[2] = colr[2] / samplDim;
      
      
    
			// Set pixel color in our image buffer------------------------------------
		  idx = (j*this.imgBuf.xSiz + i)*this.imgBuf.pixSiz;	// Array index at pixel (i,j) 
	  	this.imgBuf.fBuf[idx   ] = colr[0];	
	  	this.imgBuf.fBuf[idx +1] = colr[1];
	  	this.imgBuf.fBuf[idx +2] = colr[2];

      //break;

  	}

    //break;

  }

  this.imgBuf.float2int();		// create integer image from floating-point buffer.
}

CScene.prototype.traceRay = function(eyeRay, myHit) {

  for(k=0; k< this.item.length; k++) {  // for every CGeom in item[] array,
    this.item[k].traceMe(eyeRay, myHit);  // trace eyeRay thru it,

    //myHitList.push(myHit)
  } 
}

CScene.prototype.findShade = function(eyeRay, myHit, colr) {
    // Find eyeRay color from myHit-----------------------------------------

    // SKY COLOR
    if (myHit.hitGeom == -1) {
      vec4.copy(colr, this.skyColor);
      return;
    } 

    colrTemp = vec4.fromValues(0, 0, 0, 1);

    ambient  = vec4.create();
    diffuse  = vec4.create();
    specular = vec4.create();

    // Ground plane
    if(myHit.hitGeom.shapeType == RT_GNDPLANE) {


      xAxis = (Math.abs(myHit.hitPt[0]) < 0.25);
      yAxis = (Math.abs(myHit.hitPt[1]) < 0.25);

      if (xAxis) {
        vec4.set(myHit.hitGeom.material.K_ambi, 1.0, 0, 0, 1.0); 
        vec4.set(myHit.hitGeom.material.K_diff, 0.1, 0.1, 0.1, 1.0); 
        
      }
      else if (yAxis) {
        vec4.set(myHit.hitGeom.material.K_ambi, 0, 1, 0, 1.0); 
        vec4.set(myHit.hitGeom.material.K_diff, 0.1, 0.1, 0.1, 1.0); 
      }
      else {

        //         [      (x is divisible by 2)       ==        (y is divisible by 2)     ] == [ (x is positive)   ==   (y is positive) ]
        darkBool = (Math.abs(myHit.hitPt[0]) % 2 < 1) == (Math.abs(myHit.hitPt[1]) % 2 < 1) == (myHit.hitPt[0] > 0 == myHit.hitPt[1] > 0);


        if (darkBool) {
          //vec4.set(colr, 0, 1, 1, 1);
          vec4.set(myHit.hitGeom.material.K_ambi, 0.1, 0.1, 0.1, 1.0); 
          vec4.set(myHit.hitGeom.material.K_diff, 0.1, 0.1, 0.1, 1.0); 
          
        }
        else {
          //vec4.set(colr, 1, 0, 0, 1);
          vec4.set(myHit.hitGeom.material.K_ambi, 0.7, 0.7, 0.7, 1.0); 
          vec4.set(myHit.hitGeom.material.K_diff, 0.5, 0.5, 0.5, 1.0);
        }
      }

    }

    vec4.multiply(ambient, myHit.hitGeom.material.K_ambi, this.Ia);


    for (var k=0; k < this.lamp.length; k++) {

      if (!this.lamp[k].on) {
        continue;
      }


      // L vector (from hitPt to lamp)
      var L = vec4.create();
      vec4.sub(L, this.lamp[k].pos, myHit.hitPt);
      vec4.normalize(L, L)


      // N dot L   
      nDotL = Math.max(vec4.dot(myHit.surfNorm, L), 0.0);
      
      var R = vec4.create();
      var V = vec4.create();

      // using R to store C vector (lengthened surface normal)
      vec4.scale(R, myHit.surfNorm, nDotL);

      // R = 2C - L
      vec4.scale(R, R, 2);
      vec4.sub(R, R, L);

      // V = -eyeRay
      vec4.scale(V, eyeRay.dir, -1);
      vec4.normalize(V, V);

      // R dot V
      shiny = Math.max(vec4.dot(R, V), 0.0);

      shiny = Math.pow(shiny, myHit.hitGeom.material.K_shiny);

      // AMBIENT: Ia*Ka
      //vec4.multiply(ambient, ambient, this.lamp[k].Ia)

      
      if (!this.inShadow(myHit, L)) {

        // DIFFUSE: Id*Kd*nDotL
        vec4.multiply(R, myHit.hitGeom.material.K_diff, this.lamp[k].Id);
        vec4.scaleAndAdd(diffuse, diffuse, R, nDotL);
        
        // SPECULAR: Is*Ks*(rDotV)^Se
        vec4.multiply(R, myHit.hitGeom.material.K_spec, this.lamp[k].Is);
        vec4.scaleAndAdd(specular, specular, R, shiny);
      }
      
    //vec4.add(colr, colr, ambient);
    vec4.add(colr, colr, diffuse);
    vec4.add(colr, colr, specular);
  }

  vec4.add(colr, colr, ambient);


}

CScene.prototype.inShadow = function(myHit, L) {
  LHit = new CHit();
  LHit.init(); 

  vec4.copy(this.eyeRay.orig, myHit.hitPt);
  vec4.copy(this.eyeRay.dir, L)

  this.traceRay(this.eyeRay, LHit);
  
  // we hit an object before getting to the light source, EXCLUDING the ground plane
  return (LHit.hitNum > 0 && LHit.hitGeom.shapeType != 0);

}