//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
//==============================================================================
//
// LookAtTrianglesWithKey_ViewVolume.js (c) 2012 matsuda
//
//  MODIFIED 2014.02.19 J. Tumblin to 
//		--demonstrate multiple viewports (see 'draw()' function at bottom of file)
//		--draw ground plane in the 3D scene:  makeGroundPlane()

// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'attribute vec4 a_Normal;\n' +  //surface normal vector
  
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_NormalMatrix;\n' +  //transformation matrix of the normal vector

  'varying vec3 v_Position;\n' +
  'varying vec4 v_Color;\n' +
  'varying vec3 v_Normal;\n' +

  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' +
  '  v_Position = vec3(u_ModelMatrix * a_Position);\n' +
  '  v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
  '  v_Color = a_Color;\n' +
  '  gl_PointSize = 1.0;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +

  'uniform vec3 u_LightColor;\n' +          //light color
  'uniform vec3 u_LightPosition;\n' +       //position of the light source
  'uniform vec3 u_AmbientLightColor;\n' +   //ambient light color
  'uniform vec4 u_ColorMod;\n' +            //color modifier

  'varying vec4 v_Color;\n' +
  'varying vec3 v_Normal;\n' +
  'varying vec3 v_Position;\n' + 

  'void main() {\n' +
  //normalize the normal because it is interpolated and is not 1.0 in length anymore
  '  vec3 normal = normalize(v_Normal);\n' +
  //calculate the light direction and make it 1.0 in length
  '  vec3 lightDirection = normalize(u_LightPosition-v_Position);\n' +
  //the dot product of the light direction and the normal
  '  float nDotL = max(dot(lightDirection, normal), 0.0);\n' +  //clamped value
  //calculate the final color from diffuse reflection and ambient reflection
  '  vec4 modColor = v_Color + u_ColorMod;\n' +
  '  vec3 diffuse = u_LightColor * modColor.rgb * nDotL;\n' +
  '  vec3 ambient = u_AmbientLightColor * modColor.rgb;\n' + 
  '  gl_FragColor = vec4(diffuse+ambient, modColor.a);\n' +
  '}\n';

var ANGLE_STEP = 45.0;  
var floatsPerVertex = 10;	// # of Float32Array elements used for each vertex
													// (x,y,z)position + (r,g,b)color
var MOVE_STEP = 0.15;
var LOOK_STEP = 0.02;
var PHI_NOW = 0;
var THETA_NOW = 0;
var LAST_UPDATE = -1;

var modelMatrix = new Matrix4();
var viewMatrix = new Matrix4();
var projMatrix = new Matrix4();
var mvpMatrix = new Matrix4();
var normalMatrix = new Matrix4();
var colorMod = new Vector4();

var c30 = Math.sqrt(0.75);
var sq2 = Math.sqrt(2.0);

//var canvas;
function main() {
//==============================================================================
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight-100;

  console.log('User Guide: Press Up/Down/Left/Right keys to change the eye position.')
  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

	// NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
  //	gl.depthFunc(gl.LESS);			 
	gl.enable(gl.DEPTH_TEST); 
	
  // Set the vertex coordinates and color (the blue triangle is in the front)
  var n = initVertexBuffers(gl);

  if (n < 0) {
    console.log('Failed to specify the vertex infromation');
    return;
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.2, 0.2, 0.2, 1.0);

  // Get the storage locations of u_ViewMatrix and u_ProjMatrix variables
  var u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  var u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
  var u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
  var u_AmbientLightColor = gl.getUniformLocation(gl.program, 'u_AmbientLightColor');
  var u_ColorMod = gl.getUniformLocation(gl.program, 'u_ColorMod');
  
  if (!u_MvpMatrix || !u_ModelMatrix || !u_NormalMatrix || !u_LightColor || !u_LightPosition || !u_AmbientLightColor || !u_ColorMod) { 
    console.log('Failed to get the location of uniform variables');
    return;
  }
 
 //world coordinate system
  //set the light color --> (1.0, 1.0, 1.0)
  gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);    //modified for better visual effect
  //set the light position --> "overhead" --> y=10.0
  gl.uniform3f(u_LightPosition, 10.0, 10.0, 10.0); //modified for better visual effect
  //set the ambient light color --> (0.3, 0.3, 0.3)
  gl.uniform3f(u_AmbientLightColor, 0.3, 0.3, 0.3);

 document.onkeydown = function(ev){ keydown(ev, gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas); };

 var currentAngle = 0.0;
 var tick = function() {
    currentAngle = animate(currentAngle);  // Update the rotation angle
    draw(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas);   // Draw the triangles
    requestAnimationFrame(tick, canvas);   
                      // Request that the browser re-draw the webpage
 };
 tick(); 

}

 


function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 100;			// # of lines to draw in x,y to make the grid.
	var ycount = 100;		
	var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
 	var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
 	var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;								// y
			gndVerts[j+2] = 0.0;									// z
      gndVerts[j+3] = 1.0;
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;								// y
			gndVerts[j+2] = 0.0;									// z
      gndVerts[j+3] = 1.0;
		}
		gndVerts[j+4] = xColr[0];			// red
		gndVerts[j+5] = xColr[1];			// grn
		gndVerts[j+6] = xColr[2];			// blu
    gndVerts[j+7] = 0;  //dx
    gndVerts[j+8] = 0;  //dy
    gndVerts[j+9] = 1;  //dz
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;								// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
      gndVerts[j+3] = 1.0;
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;								// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
      gndVerts[j+3] = 1.0;
		}
		gndVerts[j+4] = yColr[0];			// red
		gndVerts[j+5] = yColr[1];			// grn
		gndVerts[j+6] = yColr[2];			// blu
    gndVerts[j+7] = 0;  //dx
    gndVerts[j+8] = 0;  //dy
    gndVerts[j+9] = 1;  //dz
	}
}

function initVertexBuffers(gl) {
//==============================================================================
  
  makeBoard();
  makeTetrahedron();
  makeBody();
  makeHead();
  //makeSphere();
  makeGroundGrid();
  makeCylinder();
  makeTorus();
  makeAxes();

  var mySiz = (bdVerts.length + ttrVerts.length + bdyVerts.length+ hdVerts.length+gndVerts.length+cylVerts.length+torVerts.length+axVerts.length+bdVerts.length);

  // How many vertices total?
  var nn = mySiz / floatsPerVertex;
  //console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
  // Copy all shapes into one big Float32 array:
  var colorShapes = new Float32Array(mySiz);

  bdStart = 0;             // we stored the cylinder first.
  for(i=0,j=0; j< bdVerts.length; i++,j++) {
    colorShapes[i] = bdVerts[j];
    }
   
  ttrStart = i;           // next, we'll store the sphere;
  for(j=0; j< ttrVerts.length; i++, j++) {// don't initialize i -- reuse it!
    colorShapes[i] = ttrVerts[j];
    }
/*
  sphStart = i;           // next we'll store the ground-plane;
  for(j=0; j< sphVerts.length; i++, j++) {
    colorShapes[i] = sphVerts[j];
    }
*/    
    bdyStart = i;           // next, we'll store the torus;
  for(j=0; j< bdyVerts.length; i++, j++) {
    colorShapes[i] = bdyVerts[j];
    }
    
    hdStart = i;           // next we'll store the ground-plane;
  for(j=0; j< hdVerts.length; i++, j++) {
    colorShapes[i] = hdVerts[j];
  }

    gndStart=i;
  for(j=0;j<gndVerts.length; i++, j++){
    colorShapes[i]=gndVerts[j];
  }
    cylStart=i;
  for(j=0;j<cylVerts.length;i++,j++){
    colorShapes[i]=cylVerts[j];
  }
    torStart=i;
  for(j=0;j<torVerts.length;i++,j++){
    colorShapes[i]=torVerts[j];
  }
    axStart=i;
  for(j=0;j<axVerts.length;i++,j++){
    colorShapes[i]=axVerts[j];
  }
    bdStart=i;
  for(j=0;j<bdVerts.length;i++,j++){
    colorShapes[i]=bdVerts[j];
  }

	// How much space to store all the shapes in one array?
	// (no 'var' means this is a global variable)
	

  
  // Create a buffer object
  var vertexColorbuffer = gl.createBuffer();  
  if (!vertexColorbuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  var shapeBufferHandle = gl.createBuffer();  
  if (!shapeBufferHandle) {
    console.log('Failed to create the shape buffer object');
    return false;
  }

  // Bind the the buffer object to target:
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
  // Transfer data from Javascript array colorShapes to Graphics system VBO
  // (Use sparingly--may be slow if you transfer large shapes stored in files)
  gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);

  var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?
    
  //Get graphics system's handle for our Vertex Shader's position-input variable: 
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return -1;
  }
  // Use handle to specify how to retrieve position data from our VBO:
  gl.vertexAttribPointer(
      a_Position,   // choose Vertex Shader attribute to fill with data
      4,            // how many values? 1,2,3 or 4.  (we're using x,y,z,w)
      gl.FLOAT,     // data type for each value: usually gl.FLOAT
      false,        // did we supply fixed-point data AND it needs normalizing?
      FSIZE * floatsPerVertex,    // Stride -- how many bytes used to store each vertex?
                    // (x,y,z,w, r,g,b) * bytes/value
      0);           // Offset -- now many bytes from START of buffer to the
                    // value we will actually use?
  gl.enableVertexAttribArray(a_Position);  
                    // Enable assignment of vertex buffer object's position data

  // Get graphics system's handle for our Vertex Shader's color-input variable;
  var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_Color < 0) {
    console.log('Failed to get the storage location of a_Color');
    return -1;
  }
  // Use handle to specify how to retrieve color data from our VBO:
  gl.vertexAttribPointer(
    a_Color,        // choose Vertex Shader attribute to fill with data
    3,              // how many values? 1,2,3 or 4. (we're using R,G,B)
    gl.FLOAT,       // data type for each value: usually gl.FLOAT
    false,          // did we supply fixed-point data AND it needs normalizing?
    FSIZE * floatsPerVertex,      // Stride -- how many bytes used to store each vertex?
                    // (x,y,z,w, r,g,b) * bytes/value
    FSIZE * 4);     // Offset -- how many bytes from START of buffer to the
                    // value we will actually use?  Need to skip over x,y,z,w
                    
  gl.enableVertexAttribArray(a_Color);  
                    // Enable assignment of vertex buffer object's position data
 var a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if(a_Normal < 0)
  {
    console.log('Failed to get the storage location of a_Normal');
    return -1;
  }
  gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, FSIZE * floatsPerVertex, FSIZE * 7);
  gl.enableVertexAttribArray(a_Normal);
  //--------------------------------DONE!
  // Unbind the buffer object 
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return nn;
}



// Global vars for Eye position. 
// NOTE!  I moved eyepoint BACKWARDS from the forest: from g_EyeZ=0.25
// a distance far enough away to see the whole 'forest' of trees within the
// 30-degree field-of-view of our 'perspective' camera.  I ALSO increased
// the 'keydown()' function's effect on g_EyeX position.


function keydown(ev, gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas) {
//------------------------------------------------------
//HTML calls this'Event handler' or 'callback function' when we press a key:

    if(ev.keyCode == 39) { // right arrow - step right
        up = new Vector3();
        up[0] = 0;
        up[1] = 1;
        up[2] = 0;
        look = new Vector3();
        look = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);

        tmpVec3 = new Vector3();
        tmpVec3 = vec3CrossProduct(up, look);

        //console.log(tmpVec3[0], tmpVec3[1], tmpVec3[2]);

        g_EyeX -= MOVE_STEP * tmpVec3[0];
        g_EyeY -= MOVE_STEP * tmpVec3[1];
        g_EyeZ -= MOVE_STEP * tmpVec3[2];

        g_LookAtX -= MOVE_STEP * tmpVec3[0];
        g_LookAtY -= MOVE_STEP * tmpVec3[1];
        g_LookAtZ -= MOVE_STEP * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);
    } 
  else 
    if (ev.keyCode == 37) { // left arrow - step left
        up = new Vector3();
        up[0] = 0;
        up[1] = 1;
        up[2] = 0;
        look = new Vector3();
        look = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);

        tmpVec3 = new Vector3();
        tmpVec3 = vec3CrossProduct(up, look);

        //console.log(tmpVec3[0], tmpVec3[1], tmpVec3[2]);

        g_EyeX += MOVE_STEP * tmpVec3[0];
        g_EyeY += MOVE_STEP * tmpVec3[1];
        g_EyeZ += MOVE_STEP * tmpVec3[2];

        g_LookAtX += MOVE_STEP * tmpVec3[0];
        g_LookAtY += MOVE_STEP * tmpVec3[1];
        g_LookAtZ += MOVE_STEP * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);
    } 
  else 
    if (ev.keyCode == 38) { // up arrow - step forward
        tmpVec3 = new Vector3();
        tmpVec3 = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);
        
        g_EyeX += MOVE_STEP * tmpVec3[0];
        g_EyeY += MOVE_STEP * tmpVec3[1];
        g_EyeZ += MOVE_STEP * tmpVec3[2];

        g_LookAtX += MOVE_STEP * tmpVec3[0];
        g_LookAtY += MOVE_STEP * tmpVec3[1];
        g_LookAtZ += MOVE_STEP * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);

    } 
    else 
    if (ev.keyCode == 40) { // down arrow - step backward
        tmpVec3 = new Vector3();
        tmpVec3 = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);
        
        g_EyeX -= MOVE_STEP * tmpVec3[0];
        g_EyeY -= MOVE_STEP * tmpVec3[1];
        g_EyeZ -= MOVE_STEP * tmpVec3[2];

        g_LookAtX -= MOVE_STEP * tmpVec3[0];
        g_LookAtY -= MOVE_STEP * tmpVec3[1];
        g_LookAtZ -= MOVE_STEP * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);
    } 
    else
    if (ev.keyCode == 65){ // a - look left
      if(LAST_UPDATE==-1 || LAST_UPDATE==0)
        {
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          
          lzx = Math.sqrt(a*a+c*c);
          sin_phi = lzx / l;

          theta0 = Math.PI -  Math.asin(a/lzx);

          THETA_NOW = theta0 + LOOK_STEP;
          
          LAST_UPDATE = 1;
        }
        else
        {
          THETA_NOW += LOOK_STEP;
        }

        g_LookAtY = b + g_EyeY;
        g_LookAtX = l * sin_phi * Math.sin(THETA_NOW) + g_EyeX;
        g_LookAtZ = l * sin_phi * Math.cos(THETA_NOW) + g_EyeZ;
    }

    else
      if(ev.keyCode==68){//d - look right
        if (LAST_UPDATE==-1 || LAST_UPDATE==0)
        {
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          lzx = Math.sqrt(a*a+c*c);
          sin_phi = lzx / l;

          theta0 = Math.PI -  Math.asin(a/lzx);

          THETA_NOW = theta0 - LOOK_STEP;
          
          LAST_UPDATE = 1;
        }
        else
        {
          THETA_NOW -= LOOK_STEP;
        }

        g_LookAtY = b + g_EyeY;
        g_LookAtX = l * sin_phi * Math.sin(THETA_NOW) + g_EyeX;
        g_LookAtZ = l * sin_phi * Math.cos(THETA_NOW) + g_EyeZ;
      }
    else
      if(ev.keyCode==87){ //w - look up
        if (LAST_UPDATE==-1 || LAST_UPDATE==1)
        {  
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          cos_theta = c / Math.sqrt(a*a + c*c);
          sin_theta = a / Math.sqrt(a*a + c*c);

          phi0 = Math.asin(b/l);

          PHI_NOW = phi0 + LOOK_STEP;
          LAST_UPDATE = 0;
        }
        else
        {
          PHI_NOW += LOOK_STEP;
        }

        g_LookAtY = l * Math.sin(PHI_NOW) + g_EyeY;
        g_LookAtX = l * Math.cos(PHI_NOW) * sin_theta + g_EyeX;
        g_LookAtZ = l * Math.cos(PHI_NOW) * cos_theta + g_EyeZ;
      }
    else
      if(ev.keyCode==83){ //s-look down
        if(LAST_UPDATE==-1 || LAST_UPDATE==1)
        { 
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
  
          cos_theta = c / Math.sqrt(a*a + c*c);
          sin_theta = a / Math.sqrt(a*a + c*c);

          phi0 = Math.asin(b/l);

          PHI_NOW = phi0 - LOOK_STEP;
          
          
          LAST_UPDATE = 0;
        }
        else
        {
          PHI_NOW -= LOOK_STEP;
        }

        g_LookAtY = l * Math.sin(PHI_NOW) + g_EyeY;
        g_LookAtX = l * Math.cos(PHI_NOW) * sin_theta + g_EyeX;
        g_LookAtZ = l * Math.cos(PHI_NOW) * cos_theta + g_EyeZ;
      }
    else
      if(ev.keyCode==112){
        console.log(' F1.');
      document.getElementById('Help1').innerHTML= 'Use Up/Down/Left/Right keys to go ahead/back/left/right';
      document.getElementById('Help2').innerHTML= 'Use W/S/A/D keys to look ahead/back/left/right.';
      }
    else { return; } // Prevent the unnecessary drawing
    draw(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas);    
}

function vec3FromEye2LookAt(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ)
{
  result = new Vector3();
  
  dx = lookAtX - eyeX;
  dy = lookAtY - eyeY;
  dz = lookAtZ - eyeZ;
  amp = Math.sqrt(dx*dx + dy*dy + dz*dz);

  result[0] = dx/amp;
  result[1] = dy/amp;
  result[2] = dz/amp;

  return result;
}

function vec3CrossProduct(up, look) //UpVec x LookVec --> Left Vec
{
  r = new Vector3();

  r[0] = up[1]*look[2] - up[2]*look[1];
  console.log('up1', up[1]);
  r[1] = up[2]*look[0] - up[0]*look[2];
  r[2] = up[0]*look[1] - up[1]*look[0];

  amp = Math.sqrt(r[0]*r[0] + r[1]*r[1] + r[2]*r[2]) + 0.000001;

  r[0] /= amp;
  r[1] /= amp;
  r[2] /= amp;

  return r;
}

var g_EyeX = 0.20, g_EyeY = 0.25, g_EyeZ = 4.25; 
var g_LookAtX = 0.0, g_LookAtY = 0.0, g_LookAtZ = 0.0;

function draw(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas) {
//==============================================================================
  
  // Clear <canvas> color AND DEPTH buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, canvas.width/2, canvas.height);
  projMatrix.setPerspective(40, (0.5*canvas.width)/canvas.height, 1, 100);
 
    // Draw in the SECOND of several 'viewports'
  //------------------------------------------
	


	// but use a different 'view' matrix:
  viewMatrix.setLookAt(g_EyeX, g_EyeY, g_EyeZ, // eye position
  										g_LookAtX, g_LookAtY, g_LookAtZ, 									// look-at point 
  										0, 1, 0);									// up vector

  // Pass the view projection matrix to our shaders:
  
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  
	// Draw the scene:
  
  drawMyScene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle,canvas);

gl.viewport(canvas.width/2, 0, canvas.width/2, canvas.height);
  projMatrix.setOrtho(-0.5*canvas.width/300, 0.5*canvas.width/300,          // left,right;
                      -canvas.height/300, canvas.height/300,          // bottom, top;
                      1, 100);       // near, far; (always >=0)

  

  viewMatrix.setLookAt(g_EyeX, g_EyeY, g_EyeZ, // eye position
                      g_LookAtX, g_LookAtY, g_LookAtZ,                  // look-at point 
                      0, 1, 0);

  drawMyScene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle,canvas);
  
  
}


function drawMyScene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas) {


  pushMatrix(modelMatrix);
  modelMatrix.setTranslate(0.0,0.0, 0.0);  // 'set' means DISCARD old matrix,
              // (drawing axes centered in CVV), and then make new
              // drawing axes moved to the lower-left corner of CVV. 
  modelMatrix.scale(1,1,-1);              // convert to left-handed coord sys
                                          // to match WebGL display canvas.
  //modelMatrix.rotate(currentAngle, 0, 1, 0);
  modelMatrix.scale(0.7, 0.7, 0.7);
/*
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, MvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, ModelMatrix.elements);
  NormalMatrix.setInverseOf(ModelMatrix);
  NormalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, NormalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  //gl.drawArrays(gl.TRIANGLES, bdStart/floatsPerVertex,bdVerts.length/floatsPerVertex);
*/
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.3, 0.3, 0.3);
  
  
  
  
  //--------Draw Tetrahedrons

  
              // if you DON'T scale, tetra goes outside the CVV; clipped!
  modelMatrix.scale(1,1,-1);
  modelMatrix.rotate(3*currentAngle, 0, 0, 1);  // Make new drawing axes that
 //modelMatrix.rotate(20.0, 0,1,0);
              // that spin around y axis (0,1,0) of the previous 
              // drawing axes, using the same origin.

  // DRAW TETRA:  Use this matrix to transform & draw 
  //            the first set of vertices stored in our VBO:
      // Pass our current matrix to the vertex shaders:
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
      // Draw just the first set of vertices: start at vertex 0...

  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);

  //modelMatrix.scale(2,2,2);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

//modelMatrix.scale(0.5,0.5,0.5);

  //modelMatrix.scale(2,2,2);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

//modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(90.0, 0, 0, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
      gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);


  modelMatrix.rotate(90.0, 0, 0, 1);
 // modelMatrix.rotate(currentAngle, 0, 0.1, 1);  // Make new drawing axes that
 //modelMatrix.rotate(20.0, 0,1,0);
              // that spin around y axis (0,1,0) of the previous 
              // drawing axes, using the same origin.

  // DRAW TETRA:  Use this matrix to transform & draw 
  //            the first set of vertices stored in our VBO:
      // Pass our current matrix to the vertex shaders:
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
      // Draw just the first set of vertices: start at vertex 0...
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
      gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);

//modelMatrix.scale(2,2,2);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

//modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(90.0, 0, 0, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
      gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);

  //modelMatrix.scale(2,2,2);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

//modelMatrix.scale(0.5,0.5,0.5);
/*
  //--------Draw Sphere
 modelMatrix.translate(0.0, 0.0, 1.0);
 modelMatrix.scale(0.3, 0.3, 0.3);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, ModelMatrix.elements);
  NormalMatrix.setInverseOf(ModelMatrix);
  NormalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, NormalMatrix.elements);
      gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
 gl.drawArrays(gl.TRIANGLE_STRIP,       // use this drawing primitive, and
                sphStart/floatsPerVertex, // start at this vertex number, and 
                sphVerts.length/floatsPerVertex); // draw this many vertices.

  modelMatrix.translate(0.0, 0.0, -3.5);
  modelMatrix.scale(2.0,2.0,2.0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, ModelMatrix.elements);
  NormalMatrix.setInverseOf(ModelMatrix);
  NormalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, NormalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices
*/
  //------------Draw Body

  //------------Draw Legs
  modelMatrix = popMatrix();
  modelMatrix.rotate(currentAngle*0.5+45, 0, 1, 0);
  modelMatrix.translate(0,0,3);

  modelMatrix.translate(0,0,-0.4);
  modelMatrix.translate(0,-0.4,0);
  pushMatrix(modelMatrix);

  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(0.3*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,0.02,0);
  modelMatrix.scale(0.25,0.25,0.25);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  //modelMatrix.scale(2,2,2);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

//modelMatrix.scale(0.5,0.5,0.5);

  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(-0.3*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,-0.02,0);
  modelMatrix.scale(0.25,0.25,0.25);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
   gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

   mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);

  //-----------Draw Body
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.5,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(90.0,1,0,0);
  modelMatrix.scale(0.25,0.25,0.25);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


  //--------------Draw Arms
  modelMatrix = popMatrix();
  modelMatrix.translate(0,-0.1,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0,1,0,0);
  modelMatrix.rotate(0.3*currentAngle, 0,-0.4, 1);
  modelMatrix.scale(0.15,0.15,0.15);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(0.8,0.8,0.8);
  modelMatrix.rotate(0.7*currentAngle, 0, -0.4, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
 gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  modelMatrix.translate(-2.0,0,0);
 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0, 0,1,0);
  modelMatrix.rotate(-0.3*currentAngle, 0, -0.4, 1);
  modelMatrix.scale(0.15,0.15,0.15);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
 gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(0.8,0.8,0.8);
  modelMatrix.rotate(-0.7*currentAngle, 0, -0.4, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);

  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  modelMatrix.translate(-2.0,0,0);
 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


  //----------Draw Head
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.2,0);
  modelMatrix.scale(0.6,0.6,0.6);
  modelMatrix.rotate(180.0,0,1,0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);

  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices



  modelMatrix.setTranslate(1.0,-0.3,-4.0);
  modelMatrix.scale(0.2,0.2,0.2);
  modelMatrix.rotate(-90.0, 1,0,0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, cylStart/floatsPerVertex,cylVerts.length/floatsPerVertex);
/*
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices
*/
  modelMatrix.setTranslate(-1.0,-0.3,-3.0);
  modelMatrix.scale(0.2,0.2,0.2);
  //modelMatrix.rotate(-90.0, 1,0,0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0.5, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, torStart/floatsPerVertex,torVerts.length/floatsPerVertex);
/*
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices
  
*/
  modelMatrix.setTranslate(0.0,0.0, -4.5);
  //modelMatrix.rotate(45.0,0,0,1);
  modelMatrix.rotate(45.0, 0,1,0);
  modelMatrix.translate(0,-0.4,0);
  modelMatrix.scale(0.5,1.5,1.5);

  //modelMatrix.rotate(-90.0, 1,0,0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0.5, 0.5, 0.5, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);
/*
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices
*/
/*
  myModelMatrix.translate(0, 0, 0.5);
  myModelMatrix.scale(0.5, 0.5, 0.5);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  myGL.uniformMatrix4fv(myu_MvpMatrix, false, myMvpMatrix.elements);
  // (where +y is 'up', as defined by our setLookAt() function call above...)
  myGL.drawArrays(myGL.TRIANGLES, 				// use this drawing primitive, and
  						  forestStart/floatsPerVertex,	// start at this vertex number, and
  						  forestVerts.length/(3*floatsPerVertex));	// draw this many vertices.

  */
 // Rotate to make a new set of 'world' drawing axes: 
 // old one had "+y points upwards", but
  modelMatrix.setTranslate(0.0, 0.0, 0.0);
  viewMatrix.rotate(-90.0, 1,0,0);	// new one has "+z points upwards",
  																		// made by rotating -90 deg on +x-axis.
  																		// Move those new drawing axes to the 
  																		// bottom of the trees:
	viewMatrix.translate(0.0, 0.0, -0.6);	
	viewMatrix.scale(0.4, 0.4,0.4);		// shrink the drawing axes 
																			//for nicer-looking ground-plane, and
  // Pass the modified view matrix to our shaders:
  
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  
  // Now, using these drawing axes, draw our ground plane: 
  gl.drawArrays(gl.LINES,							// use this drawing primitive, and
  							gndStart/floatsPerVertex,	// start at this vertex number, and
  							gndVerts.length/floatsPerVertex);		// draw this many vertices

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

/*
  modelMatrix.scale(10.0, 10.0, 10.0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices
*/
}

function makeTetrahedron() {
  ttrVerts = new Float32Array([
    /*  Nodes:
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  // Node 0
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  // Node 1
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  // Node 2
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  // Node 3
    */

      // Face 0
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  3.00,-0.87,1.74,// Node 0
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  3.00,-0.87,1.74,// Node 1
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  3.00,-0.87,1.74,// Node 2
      // Face 1(front)
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  0.00,-0.87,-3.48,// Node 0
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  0.00,-0.87,-3.48,// Node 2
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  0.00,-0.87,-3.48,// Node 3
      // Face 2
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  -1.00,-0.87,1.74,// Node 0 
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  -1.00,-0.87,1.74,// Node 3
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  -1.00,-0.87,1.74,// Node 1 
      // Face 3  
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  0.00,-2.61,0.00,// Node 3
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  0.00,-2.61,0.00,// Node 2
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  0.00,-2.61,0.00,// Node 1
    ]);
}


function makeBoard() {
   bdVerts = new Float32Array([
    -1.00,-1.00, 0.00, 1.00,     1.0, 1.0,  0.8,    0,1,0,
     1.00,-1.00, 0.00, 1.00,    0.9,  1.0,  1.0,    0,1,0,
     1.00,1.00,0.00,1.00,        1.0,0.6,0.5,       0,1,0,

     1.00, 1.00, 0.00, 1.00,    1.0,0.6,0.5,        0,1,0,
    -1.00, 1.00, 0.00, 1.00,    0.6,  1.0,  0.6,    0,1,0,  
     -1.00,-1.00, 0.00, 1.00,    1.0,  1.0,  0.8,    0,1,0,
    ]);
}


function makeBody() {
  bdyVerts = new Float32Array([
    /*  Nodes:
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  //Node 0
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  //Node 1
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  //Node 2
     0,0.1,0.1,1.0,   0,0.4,0,  //Node 3
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  //Node 4
     -2,0.1,0.1,1.0,  0,0.8,0.8,  //Node 5
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  //Node6
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    //Node7
*/

      // Former
      0,0.1,0.1,1.0,   0,0.4,0,  0,0,1,// Node 3
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  0,0,1,// Node 0
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  0,0,1,//Node 6

     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  0,0,1,//Node6
     -2,0.1,0.1,1.0,  0,0.8,0.8,  0,0,1,//Node 5
     0,0.1,0.1,1.0,   0,0.4,0,  0,0,1,//Node 3
    
    // Left
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  -1,0,0,//Node 4
     -2,0.1,0.1,1.0,  0,0.8,0.8,  -1,0,0,//Node 5
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  -1,0,0,//Node6

     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  -1,0,0,//Node6
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    -1,0,0,//Node7
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  -1,0,0,//Node 4

      // Back 
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  0,0,-1,//Node 1
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  0,0,-1,//Node 2
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  0,0,-1,//Node 4

     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  0,0,-1,//Node 4
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    0,0,-1,//Node7
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  0,0,-1,//Node 1

     //Right
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  1,0,0,//Node 0
    0,0.1,0.1,1.0,   0,0.4,0,  1,0,0,//Node 3
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  1,0,0,//Node 2

     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  1,0,0,//Node 2
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5, 1,0,0, //Node 1
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  1,0,0,//Node 0

    //Top
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  0,1,0,//Node 2
     0,0.1,0.1,1.0,   0,0.4,0,  0,1,0,//Node 3
     -2,0.1,0.1,1.0,  0,0.8,0.8,  0,1,0,//Node 5

     -2,0.1,0.1,1.0,  0,0.8,0.8,  0,1,0,//Node 5
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  0,1,0,//Node 4
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  0,1,0,//Node 2

     //Bottom
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  0,-1,0,//Node 0
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5, 0,-1,0, //Node 1
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,  0,-1,0, //Node7

     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,  0,-1,0,  //Node7
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0, 0,-1,0, //Node6
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0, 0,-1,0, //Node 0
    ]);
}

function makeHead() {
  hdVerts = new Float32Array([
    /*Nodes:
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  //Node 0
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 1
  0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 2
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  //Node 3
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 4
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 5
  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 6
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 7

 */
 //Former
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7, 0,0,1, //Node 1
  0.2,-0.2,0.2,1.0, 1,0.9,0.7,  0,0,1,//Node 2
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  0,0,1,//Node 3

  0.2,0.2,0.2,1.0,  1,0.9,0.7,  0,0,1,//Node 3
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  0,0,1,//Node 0
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  0,0,1,//Node 1

//Right
  0.2,0.2,0.2,1.0,  1,0.9,0.7, 1,0,0, //Node 3
  0.2,-0.2,0.2,1.0, 1,0.9,0.7, 1,0,0, //Node 2
  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  1,0,0,//Node 6

  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4, 1,0,0, //Node 6
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4, 1,0,0, //Node 5
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  1,0,0,//Node 3

//Back
    -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  0,0,-1,//Node 4
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  0,0,-1,//Node 7
  0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  0,0,-1,//Node 6

  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  0,0,-1,//Node 6
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4, 0,0,-1, //Node 5
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  0,0,-1,//Node 4

//Left
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  -1,0,0,//Node 0
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  -1,0,0,//Node 1
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  -1,0,0,//Node 7

  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  -1,0,0,//Node 7
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4, -1,0,0, //Node 4
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  -1,0,0,//Node 0

//Top
  -0.2,0.2,0.2,1.0, 1,0.9,0.7, 0,1,0, //Node 0
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  0,1,0,//Node 3
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  0,1,0,//Node 5

  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  0,1,0,//Node 5
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4, 0,1,0, //Node 4
  -0.2,0.2,0.2,1.0, 1,0.9,0.7, 0,1,0, //Node 0

//Bottom
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  0,-1,0,//Node 1
  0.2,-0.2,0.2,1.0, 1,0.9,0.7,  0,-1,0,//Node 2
  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  0,-1,0,//Node 6

  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  0,-1,0,//Node 6
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  0,-1,0,//Node 7
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7, 0,-1,0,//Node 1
  ]);
}

/*
function makeSphere() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
// sphere from one triangle strip.
  var slices = 13;    // # of slices of the sphere along the z axis. >=3 req'd
                      // (choose odd # or prime# to avoid accidental symmetry)
  var sliceVerts  = 27; // # of vertices around the top edge of the slice
                      // (same number of vertices on bottom of slice, too)
  var topColr = new Float32Array([0.7, 0.7, 0.7]);  // North Pole: light gray
  var equColr = new Float32Array([0.3, 0.7, 0.3]);  // Equator:    bright green
  var botColr = new Float32Array([0.9, 0.9, 0.9]);  // South Pole: brightest gray.
  var sliceAngle = Math.PI/slices;  // lattitude angle spanned by one slice.

  // Create a (global) array to hold this sphere's vertices:
  sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * floatsPerVertex);
                    // # of vertices * # of elements needed to store them. 
                    // each slice requires 2*sliceVerts vertices except 1st and
                    // last ones, which require only 2*sliceVerts-1.
                    
  // Create dome-shaped top slice of sphere at z=+1
  // s counts slices; v counts vertices; 
  // j counts array elements (vertices * elements per vertex)
  var cos0 = 0.0;         // sines,cosines of slice's top, bottom edge.
  var sin0 = 0.0;
  var cos1 = 0.0;
  var sin1 = 0.0; 
  var j = 0;              // initialize our array index
  var isLast = 0;
  var isFirst = 1;
  for(s=0; s<slices; s++) { // for each slice of the sphere,
    // find sines & cosines for top and bottom of this slice
    if(s==0) {
      isFirst = 1;  // skip 1st vertex of 1st slice.
      cos0 = 1.0;   // initialize: start at north pole.
      sin0 = 0.0;
    }
    else {          // otherwise, new top edge == old bottom edge
      isFirst = 0;  
      cos0 = cos1;
      sin0 = sin1;
    }               // & compute sine,cosine for new bottom edge.
    cos1 = Math.cos((s+1)*sliceAngle);
    sin1 = Math.sin((s+1)*sliceAngle);
    // go around the entire slice, generating TRIANGLE_STRIP verts
    // (Note we don't initialize j; grows with each new attrib,vertex, and slice)
    if(s==slices-1) isLast=1; // skip last vertex of last slice.
    for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) { 
      if(v%2==0)
      {       // put even# vertices at the the slice's top edge
              // (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
              // and thus we can simplify cos(2*PI(v/2*sliceVerts))  
        sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts);  
        sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);  
        sphVerts[j+2] = cos0;   
        sphVerts[j+3] = 1.0;      
      }
      else {  // put odd# vertices around the slice's lower edge;
              // x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
              //          theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
        sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);    // x
        sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);    // y
        sphVerts[j+2] = cos1;                                       // z
        sphVerts[j+3] = 1.0;                                        // w.   
      }
      if(s==0) {  // finally, set some interesting colors for vertices:
        sphVerts[j+4]=topColr[0]; 
        sphVerts[j+5]=topColr[1]; 
        sphVerts[j+6]=topColr[2]; 
        }
      else if(s==slices-1) {
        sphVerts[j+4]=botColr[0]; 
        sphVerts[j+5]=botColr[1]; 
        sphVerts[j+6]=botColr[2]; 
      }
      else {
          sphVerts[j+4]=Math.random();// equColr[0]; 
          sphVerts[j+5]=Math.random();// equColr[1]; 
          sphVerts[j+6]=Math.random();// equColr[2];          
      }
    }
  }
}
*/
function makeCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
//
 var ctrColr = new Float32Array([0.2, 0.2, 0.2]); // dark gray
 var topColr = new Float32Array([0.4, 0.7, 0.4]); // light green
 var botColr = new Float32Array([0.5, 0.5, 1.0]); // light blue
 var capVerts = 16; // # of vertices around the topmost 'cap' of the shape
 var botRadius = 1.6;   // radius of bottom of cylinder (top always 1.0)
 
 // Create a (global) array to hold this cylinder's vertices;
 cylVerts = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);
                    // # of vertices * # of elements needed to store them. 

  // Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
  // v counts vertices: j counts array elements (vertices * elements per vertex)
  for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {  
    // skip the first vertex--not needed.
    if(v%2==0)
    {       // put even# vertices at center of cylinder's top cap:
      cylVerts[j  ] = 0.0;      // x,y,z,w == 0,0,1,1
      cylVerts[j+1] = 0.0;  
      cylVerts[j+2] = 1.0; 
      cylVerts[j+3] = 1.0;      // r,g,b = topColr[]
      cylVerts[j+4]=ctrColr[0]; 
      cylVerts[j+5]=ctrColr[1]; 
      cylVerts[j+6]=ctrColr[2];
      cylVerts[j+7] = 0;  //dx
      cylVerts[j+8] = 0;  //dy
      cylVerts[j+9] = 1;  //dz
    }
    else {  // put odd# vertices around the top cap's outer edge;
            // x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
            //          theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
      cylVerts[j  ] = Math.cos(Math.PI*(v-1)/capVerts);     // x
      cylVerts[j+1] = Math.sin(Math.PI*(v-1)/capVerts);     // y
      //  (Why not 2*PI? because 0 < =v < 2*capVerts, so we
      //   can simplify cos(2*PI * (v-1)/(2*capVerts))
      cylVerts[j+2] = 1.0;  // z
      cylVerts[j+3] = 1.0;  // w.
      // r,g,b = topColr[]
      cylVerts[j+4]=topColr[0]; 
      cylVerts[j+5]=topColr[1]; 
      cylVerts[j+6]=topColr[2];
      cylVerts[j+7] = 0;  //dx
      cylVerts[j+8] = 0;  //dy
      cylVerts[j+9] = 1;  //dz     
    }
  }
  // Create the cylinder side walls, made of 2*capVerts vertices.
  // v counts vertices within the wall; j continues to count array elements
  for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
    if(v%2==0)  // position all even# vertices along top cap:
    {   
        cylVerts[j  ] = Math.cos(Math.PI*(v)/capVerts);   // x
        cylVerts[j+1] = Math.sin(Math.PI*(v)/capVerts);   // y
        cylVerts[j+2] = 1.0;  // z
        cylVerts[j+3] = 1.0;  // w.
        // r,g,b = topColr[]
        cylVerts[j+4]=topColr[0]; 
        cylVerts[j+5]=topColr[1]; 
        cylVerts[j+6]=topColr[2];  
        cylVerts[j+7] = Math.cos(Math.PI*(v)/capVerts); //dx
      cylVerts[j+8] = Math.sin(Math.PI*(v)/capVerts); //dy
      cylVerts[j+9] = 0;   
    }
    else    // position all odd# vertices along the bottom cap:
    {
        cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);   // x
        cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);   // y
        cylVerts[j+2] =-1.0;  // z
        cylVerts[j+3] = 1.0;  // w.
        // r,g,b = topColr[]
        cylVerts[j+4]=botColr[0]; 
        cylVerts[j+5]=botColr[1]; 
        cylVerts[j+6]=botColr[2];  
        cylVerts[j+7] = Math.cos(Math.PI*(v-1)/capVerts); //dx
      cylVerts[j+8] = Math.sin(Math.PI*(v-1)/capVerts); //dy
      cylVerts[j+9] = 0;   
    }
  }
  // Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
  // v counts the vertices in the cap; j continues to count array elements
  for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
    if(v%2==0) {  // position even #'d vertices around bot cap's outer edge
      cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);   // x
      cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v)/capVerts);   // y
      cylVerts[j+2] =-1.0;  // z
      cylVerts[j+3] = 1.0;  // w.
      // r,g,b = topColr[]
      cylVerts[j+4]=botColr[0]; 
      cylVerts[j+5]=botColr[1]; 
      cylVerts[j+6]=botColr[2]; 
      cylVerts[j+7] = 0;
      cylVerts[j+8] = 0;
      cylVerts[j+9] = -1;   
    }
    else {        // position odd#'d vertices at center of the bottom cap:
      cylVerts[j  ] = 0.0;      // x,y,z,w == 0,0,-1,1
      cylVerts[j+1] = 0.0;  
      cylVerts[j+2] =-1.0; 
      cylVerts[j+3] = 1.0;      // r,g,b = botColr[]
      cylVerts[j+4]=botColr[0]; 
      cylVerts[j+5]=botColr[1]; 
      cylVerts[j+6]=botColr[2];
      cylVerts[j+7] = 0;
      cylVerts[j+8] = 0;
      cylVerts[j+9] = -1;
    }

  }
}

function makeTorus() {
//==============================================================================
//    Create a torus centered at the origin that circles the z axis.  
// Terminology: imagine a torus as a flexible, cylinder-shaped bar or rod bent 
// into a circle around the z-axis. The bent bar's centerline forms a circle
// entirely in the z=0 plane, centered at the origin, with radius 'rbend'.  The 
// bent-bar circle begins at (rbend,0,0), increases in +y direction to circle  
// around the z-axis in counter-clockwise (CCW) direction, consistent with our
// right-handed coordinate system.
//    This bent bar forms a torus because the bar itself has a circular cross-
// section with radius 'rbar' and angle 'phi'. We measure phi in CCW direction 
// around the bar's centerline, circling right-handed along the direction 
// forward from the bar's start at theta=0 towards its end at theta=2PI.
//    THUS theta=0, phi=0 selects the torus surface point (rbend+rbar,0,0);
// a slight increase in phi moves that point in -z direction and a slight
// increase in theta moves that point in the +y direction.  
// To construct the torus, begin with the circle at the start of the bar:
//          xc = rbend + rbar*cos(phi); 
//          yc = 0; 
//          zc = -rbar*sin(phi);      (note negative sin(); right-handed phi)
// and then rotate this circle around the z-axis by angle theta:
//          x = xc*cos(theta) - yc*sin(theta)   
//          y = xc*sin(theta) + yc*cos(theta)
//          z = zc
// Simplify: yc==0, so
//          x = (rbend + rbar*cos(phi))*cos(theta)
//          y = (rbend + rbar*cos(phi))*sin(theta) 
//          z = -rbar*sin(phi)
// To construct a torus from a single triangle-strip, make a 'stepped spiral' along the length of the bent bar; successive rings of constant-theta, using the same design used for cylinder walls in 'makeCyl()' and for 'slices' in makeSphere().  Unlike the cylinder and sphere, we have no 'special case' for the first and last of these bar-encircling rings.
//
var rbend = 1.0;                    // Radius of circle formed by torus' bent bar
var rbar = 0.5;                     // radius of the bar we bent to form torus
var barSlices = 23;                 // # of bar-segments in the torus: >=3 req'd;
                                    // more segments for more-circular torus
var barSides = 13;                    // # of sides of the bar (and thus the 
                                    // number of vertices in its cross-section)
                                    // >=3 req'd;
                                    // more sides for more-circular cross-section
// for nice-looking torus with approx square facets, 
//      --choose odd or prime#  for barSides, and
//      --choose pdd or prime# for barSlices of approx. barSides *(rbend/rbar)
// EXAMPLE: rbend = 1, rbar = 0.5, barSlices =23, barSides = 11.

  // Create a (global) array to hold this torus's vertices:
 torVerts = new Float32Array(floatsPerVertex*(2*barSides*barSlices +2));
//  Each slice requires 2*barSides vertices, but 1st slice will skip its first 
// triangle and last slice will skip its last triangle. To 'close' the torus,
// repeat the first 2 vertices at the end of the triangle-strip.  Assume 7
//tangent vector with respect to big circle
  var tx = 0.0;
  var ty = 0.0;
  var tz = 0.0;
  //tangent vector with respect to small circle
  var sx = 0.0;
  var sy = 0.0;
  var sz = 0.0;
var phi=0, theta=0;                   // begin torus at angles 0,0
var thetaStep = 2*Math.PI/barSlices;  // theta angle between each bar segment
var phiHalfStep = Math.PI/barSides;   // half-phi angle between each side of bar
                                      // (WHY HALF? 2 vertices per step in phi)
  // s counts slices of the bar; v counts vertices within one slice; j counts
  // array elements (Float32) (vertices*#attribs/vertex) put in torVerts array.
  for(s=0,j=0; s<barSlices; s++) {    // for each 'slice' or 'ring' of the torus:
    for(v=0; v< 2*barSides; v++, j+=floatsPerVertex) {    // for each vertex in this slice:
      if(v%2==0)  { // even #'d vertices at bottom of slice,
        torVerts[j  ] = (rbend + rbar*Math.cos((v)*phiHalfStep)) * 
                                             Math.cos((s)*thetaStep);
                //  x = (rbend + rbar*cos(phi)) * cos(theta)
        torVerts[j+1] = (rbend + rbar*Math.cos((v)*phiHalfStep)) *
                                             Math.sin((s)*thetaStep);
                //  y = (rbend + rbar*cos(phi)) * sin(theta) 
        torVerts[j+2] = -rbar*Math.sin((v)*phiHalfStep);
                //  z = -rbar  *   sin(phi)
        torVerts[j+3] = 1.0;    // w
        //find normal
        tx = (-1) * Math.sin(s*thetaStep);
        ty = Math.cos(s*thetaStep);
        tz = 0.0;

        sx = Math.cos(s*thetaStep) * (-1) * Math.sin(v*phiHalfStep);
        sy = Math.sin(s*thetaStep) * (-1) * Math.sin(v*phiHalfStep);
        sz = (-1) * Math.cos(v*phiHalfStep);

        torVerts[j+7] = -ty*sz + tz*sy;
        torVerts[j+8] = -tz*sx + tx*sz;
        torVerts[j+9] = -tx*sy + ty*sx;
      }
      else {        // odd #'d vertices at top of slice (s+1);
                    // at same phi used at bottom of slice (v-1)
        torVerts[j  ] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) * 
                                             Math.cos((s+1)*thetaStep);
                //  x = (rbend + rbar*cos(phi)) * cos(theta)
        torVerts[j+1] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) *
                                             Math.sin((s+1)*thetaStep);
                //  y = (rbend + rbar*cos(phi)) * sin(theta) 
        torVerts[j+2] = -rbar*Math.sin((v-1)*phiHalfStep);
                //  z = -rbar  *   sin(phi)
        torVerts[j+3] = 1.0;    // w
        tx = (-1) * Math.sin((s+1)*thetaStep);
        ty = Math.cos((s+1)*thetaStep);
        tz = 0.0;

        sx = Math.cos((s+1)*thetaStep) * (-1) * Math.sin((v-1)*phiHalfStep);
        sy = Math.sin((s+1)*thetaStep) * (-1) * Math.sin((v-1)*phiHalfStep);
        sz = (-1) * Math.cos((v-1)*phiHalfStep);

        torVerts[j+7] = -ty*sz + tz*sy;
        torVerts[j+8] = -tz*sx + tx*sz;
        torVerts[j+9] = -tx*sy + ty*sx;
      }
      torVerts[j+4] = Math.random();    // random color 0.0 <= R < 1.0
      torVerts[j+5] = Math.random();    // random color 0.0 <= G < 1.0
      torVerts[j+6] = Math.random();    // random color 0.0 <= B < 1.0
    }
  }
  // Repeat the 1st 2 vertices of the triangle strip to complete the torus:
      torVerts[j  ] = rbend + rbar; // copy vertex zero;
              //  x = (rbend + rbar*cos(phi==0)) * cos(theta==0)
      torVerts[j+1] = 0.0;
              //  y = (rbend + rbar*cos(phi==0)) * sin(theta==0) 
      torVerts[j+2] = 0.0;
              //  z = -rbar  *   sin(phi==0)
      torVerts[j+3] = 1.0;    // w
      torVerts[j+4] = Math.random();    // random color 0.0 <= R < 1.0
      torVerts[j+5] = Math.random();    // random color 0.0 <= G < 1.0
      torVerts[j+6] = Math.random();    // random color 0.0 <= B < 1.0
      j+=floatsPerVertex; // go to next vertex:
      torVerts[j  ] = (rbend + rbar) * Math.cos(thetaStep);
              //  x = (rbend + rbar*cos(phi==0)) * cos(theta==thetaStep)
      torVerts[j+1] = (rbend + rbar) * Math.sin(thetaStep);
              //  y = (rbend + rbar*cos(phi==0)) * sin(theta==thetaStep) 
      torVerts[j+2] = 0.0;
              //  z = -rbar  *   sin(phi==0)
      torVerts[j+3] = 1.0;    // w
      torVerts[j+4] = Math.random();    // random color 0.0 <= R < 1.0
      torVerts[j+5] = Math.random();    // random color 0.0 <= G < 1.0
      torVerts[j+6] = Math.random();    // random color 0.0 <= B < 1.0
      torVerts[j+7] = 1.0;
      torVerts[j+8] = 0.0;
      torVerts[j+9] = 0.0;
}

function makeAxes(){
   axVerts = new Float32Array([
     0,0,0,1,     1.0,1.0,1.0, 0,1,0,
     1,0,0,1,     1.0, 0.0,  0.0,  0,1,0,

     0,0,0,1,     1.0,1.0,1.0,  0,0,1,
     0,1,0,1,     0.0,  1.0,  0.0,  0,0,1,

     0,0,0,1,     1.0,1.0,1.0,  1,0,0,
     0,0,1,1,     0.0,0.0,1.0,  1,0,0,
    ]);
}

function makeBoard() {
   bdVerts = new Float32Array([
    -1.00,-1.00, 0.00, 1.00,     1.0, 1.0,  0.8,    0,0,1,
     1.00,-1.00, 0.00, 1.00,    0.9,  1.0,  1.0,    0,0,1,
     1.00,1.00,0.00,1.00,        1.0,0.6,0.5,   0,0,1,

     1.00, 1.00, 0.00, 1.00,    1.0,0.6,0.5,    0,0,1,
    -1.00, 1.00, 0.00, 1.00,    0.6,  1.0,  0.6,  0,0,1,  
     -1.00,-1.00, 0.00, 1.00,    1.0,  1.0,  0.8,   0,0,1,
    ]);
}

var g_last = Date.now();

function animate(angle) {
//==============================================================================
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now;
  
  // Update the current rotation angle (adjusted by the elapsed time)
  //  limit the angle to move smoothly between +20 and -85 degrees:
if(angle >  0.0 && ANGLE_STEP > 0) ANGLE_STEP = -ANGLE_STEP;
if(angle < -180.0 && ANGLE_STEP < 0) ANGLE_STEP = -ANGLE_STEP;
  
var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
return newAngle %= 360;
}

function resize()
{
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight-100;
}
