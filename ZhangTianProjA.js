//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// ColoredMultiObject.js  MODIFIED for EECS 351-1, 
//                  Northwestern Univ. Jack Tumblin
//    --converted from 2D to 4D (x,y,z,w) vertices
//    --demonstrate how to keep & use MULTIPLE colored shapes in just one
//      Vertex Buffer Object(VBO). 
//    --demonstrate 'nodes' vs. 'vertices'; geometric corner locations where
//        OpenGL/WebGL requires multiple co-located vertices to implement the
//        meeting point of multiple diverse faces.
//
// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
  'uniform mat4 u_ModelMatrix;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_ModelMatrix * a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

// Global Variable -- Rotation angle rate (degrees/second)
var ANGLE_STEP = 45.0;
var floatsPerVertex = 7;
//var COLOR_STEP = 0.3;

// Global vars for mouse click-and-drag for rotation.
var isDrag=false;   // mouse-drag: true when user holds down mouse button
var xMclik=0.0;     // last mouse button-down position (in CVV coords)
var yMclik=0.0;   
var xMdragTot=0.0;  // total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;
var keyMovex=0.0;
var keyMovey=0.0;  

function main() {
//==============================================================================
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

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

  // First, register all mouse events found within our HTML-5 canvas:
  canvas.onmousedown  = function(ev){myMouseDown( ev, gl, canvas) }; 
  
            // when user's mouse button goes down call mouseDown() function
  canvas.onmousemove =  function(ev){myMouseMove( ev, gl, canvas) };
  
                      // call mouseMove() function          
  canvas.onmouseup =    function(ev){myMouseUp(   ev, gl, canvas)};
            // NOTE! 'onclick' event is SAME as on 'mouseup' event
            // in Chrome Brower on MS Windows 7, and possibly other 
            // operating systems; use 'mouseup' instead.
            
  // Next, register all keyboard events found within our HTML webpage window:
  window.addEventListener("keydown", myKeyDown, false);
  window.addEventListener("keyup", myKeyUp, false);
  window.addEventListener("keypress", myKeyPress, false);

  // 
  
  var n = initVertexBuffer(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }
  

  // Specify the color for clearing <canvas>
  gl.clearColor(1, 0.7, 0.8, 1.0);

  // NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
  // unless the new Z value is closer to the eye than the old one..
//  gl.depthFunc(gl.LESS);
  gl.enable(gl.DEPTH_TEST);     
  
  // Get handle to graphics system's storage location of u_ModelMatrix
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) { 
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }
  // Create a local version of our model matrix in JavaScript 
  var modelMatrix = new Matrix4();
  
  // Create, init current rotation angle value in JavaScript
  var currentAngle = 0.0;
  //var currentColor = 0.0;
  

//-----------------  

  // Start drawing: create 'tick' variable whose value is this function:
  var tick = function() {
    currentAngle = animate(currentAngle);  // Update the rotation angle
    //currentColor = colorChange(currentColor);
    /*
    var n = initVertexBuffer(gl,currentColor);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }
  */
    draw(gl, n, currentAngle, modelMatrix, u_ModelMatrix);   // Draw shapes
    //console.log('currentAngle=',currentAngle);
    //console.log('currentColor=',currentColor);
   
    //document.getElementById('CurAngleDisplay').innerHTML= 'CurrentAngle= '+currentAngle;
    // Also display our current mouse-dragging state:
    //document.getElementById('Mouse').innerHTML='Mouse Drag totals (CVV coords):\t'+xMdragTot+', \t'+yMdragTot;

    requestAnimationFrame(tick, canvas);   
                      // Request that the browser re-draw the webpage
  };
  tick();             // start (and continue) animation: draw current image
  
}

function initVertexBuffer(gl) {
//==============================================================================
  makeBoard();
  makeTetrahedron();
  makeBody();
  makeHead();
  makeSphere();

  var mySiz = (bdVerts.length + ttrVerts.length + sphVerts.length+ bdyVerts.length+ hdVerts.length);

  // How many vertices total?
  var nn = mySiz / floatsPerVertex;
  console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
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

  sphStart = i;           // next we'll store the ground-plane;
  for(j=0; j< sphVerts.length; i++, j++) {
    colorShapes[i] = sphVerts[j];
    }
    
    bdyStart = i;           // next, we'll store the torus;
  for(j=0; j< bdyVerts.length; i++, j++) {
    colorShapes[i] = bdyVerts[j];
    }
    
    hdStart = i;           // next we'll store the ground-plane;
  for(j=0; j< hdVerts.length; i++, j++) {
    colorShapes[i] = hdVerts[j];
  }
  // Create a buffer object
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
      FSIZE * 7,    // Stride -- how many bytes used to store each vertex?
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
    FSIZE * 7,      // Stride -- how many bytes used to store each vertex?
                    // (x,y,z,w, r,g,b) * bytes/value
    FSIZE * 4);     // Offset -- how many bytes from START of buffer to the
                    // value we will actually use?  Need to skip over x,y,z,w
                    
  gl.enableVertexAttribArray(a_Color);  
                    // Enable assignment of vertex buffer object's position data

  //--------------------------------DONE!
  // Unbind the buffer object 
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return nn;
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
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  // Node 0
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  // Node 1
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  // Node 2
      // Face 1
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  // Node 0
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  // Node 2
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  // Node 3
      // Face 2
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  // Node 0 
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  // Node 3
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  // Node 1 
      // Face 3  
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  // Node 3
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  // Node 2
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  // Node 1
    ]);
}


function makeBoard() {
   bdVerts = new Float32Array([
    -1.00,-1.00, 0.00, 1.00,     1.0, 1.0,  0.8,
     1.00,-1.00, 0.00, 1.00,    0.9,  1.0,  1.0, 
     1.00,1.00,0.00,1.00,        1.0,0.6,0.5,

     1.00, 1.00, 0.00, 1.00,    1.0,0.6,0.5,
    -1.00, 1.00, 0.00, 1.00,    0.6,  1.0,  0.6,   
     -1.00,-1.00, 0.00, 1.00,    1.0,  1.0,  0.8,
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
      0,0.1,0.1,1.0,   0,0.4,0,  // Node 3
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  // Node 0
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  //Node 6

     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  //Node6
     -2,0.1,0.1,1.0,  0,0.8,0.8,  //Node 5
     0,0.1,0.1,1.0,   0,0.4,0,  //Node 3
    
    // Left
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  //Node 4
     -2,0.1,0.1,1.0,  0,0.8,0.8,  //Node 5
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  //Node6

     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  //Node6
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    //Node7
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  //Node 4

      // Back 
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  //Node 1
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  //Node 2
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  //Node 4

     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  //Node 4
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    //Node7
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  //Node 1

     //Right
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  //Node 0
    0,0.1,0.1,1.0,   0,0.4,0,  //Node 3
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  //Node 2

     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  //Node 2
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  //Node 1
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  //Node 0

    //Top
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  //Node 2
     0,0.1,0.1,1.0,   0,0.4,0,  //Node 3
     -2,0.1,0.1,1.0,  0,0.8,0.8,  //Node 5

     -2,0.1,0.1,1.0,  0,0.8,0.8,  //Node 5
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  //Node 4
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  //Node 2

     //Bottom
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  //Node 0
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  //Node 1
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    //Node7

     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    //Node7
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  //Node6
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  //Node 0
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
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 1
  0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 2
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  //Node 3

  0.2,0.2,0.2,1.0,  1,0.9,0.7,  //Node 3
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  //Node 0
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 1

//Right
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  //Node 3
  0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 2
  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 6

  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 6
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 5
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  //Node 3

//Back
    -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 4
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 7
  0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 6

  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 6
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 5
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 4

//Left
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  //Node 0
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 1
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 7

  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 7
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 4
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  //Node 0

//Top
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  //Node 0
  0.2,0.2,0.2,1.0,  1,0.9,0.7,  //Node 3
  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 5

  0.2,0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 5
  -0.2,0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 4
  -0.2,0.2,0.2,1.0, 1,0.9,0.7,  //Node 0

//Bottom
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 1
  0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 2
  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 6

  0.2,-0.2,-0.2,1.0,  0.4,0.4,0.4,  //Node 6
  -0.2,-0.2,-0.2,1.0, 0.4,0.4,0.4,  //Node 7
  -0.2,-0.2,0.2,1.0, 1,0.9,0.7,  //Node 1
  ]);
}


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



function draw(gl, n, currentAngle, modelMatrix, u_ModelMatrix) {
//==============================================================================
  // Clear <canvas>  colors AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //-------Draw Board
  modelMatrix.setTranslate(0.0,0.0, 0.0);  // 'set' means DISCARD old matrix,
              // (drawing axes centered in CVV), and then make new
              // drawing axes moved to the lower-left corner of CVV. 
  modelMatrix.scale(1,1,-1);              // convert to left-handed coord sys
                                          // to match WebGL display canvas.
  var dist = Math.sqrt(xMdragTot*xMdragTot + yMdragTot*yMdragTot);
              // why add 0.001? avoids divide-by-zero in next statement
              // in cases where user didn't drag the mouse.)
  modelMatrix.rotate(dist*120.0, -yMdragTot+0.0001, xMdragTot+0.0001, 0.0);
  modelMatrix.translate(keyMovex,keyMovey,0);

  modelMatrix.rotate(currentAngle, 0, 1, 0);
  modelMatrix.scale(0.7, 0.7, 0.7);

  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdStart/floatsPerVertex,bdVerts.length/floatsPerVertex);

  pushMatrix(modelMatrix);

  modelMatrix.scale(0.3, 0.3, 0.3);
  
  
  
  
  //--------Draw Tetrahedrons

  
              // if you DON'T scale, tetra goes outside the CVV; clipped!
  modelMatrix.rotate(3*currentAngle, 0, 0, 1);  // Make new drawing axes that
 //modelMatrix.rotate(20.0, 0,1,0);
              // that spin around y axis (0,1,0) of the previous 
              // drawing axes, using the same origin.

  // DRAW TETRA:  Use this matrix to transform & draw 
  //            the first set of vertices stored in our VBO:
      // Pass our current matrix to the vertex shaders:
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
      // Draw just the first set of vertices: start at vertex 0...
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);

  modelMatrix.rotate(90.0, 0, 0, 1);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);


  modelMatrix.rotate(90.0, 0, 0, 1);
 // modelMatrix.rotate(currentAngle, 0, 0.1, 1);  // Make new drawing axes that
 //modelMatrix.rotate(20.0, 0,1,0);
              // that spin around y axis (0,1,0) of the previous 
              // drawing axes, using the same origin.

  // DRAW TETRA:  Use this matrix to transform & draw 
  //            the first set of vertices stored in our VBO:
      // Pass our current matrix to the vertex shaders:
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
      // Draw just the first set of vertices: start at vertex 0...
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);

  modelMatrix.rotate(90.0, 0, 0, 1);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, ttrStart/floatsPerVertex,ttrVerts.length/floatsPerVertex);

  //--------Draw Sphere
 modelMatrix.translate(0.0, 0.0, 1.0);
 modelMatrix.scale(0.3, 0.3, 0.3);
 gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
 gl.drawArrays(gl.TRIANGLE_STRIP,       // use this drawing primitive, and
                sphStart/floatsPerVertex, // start at this vertex number, and 
                sphVerts.length/floatsPerVertex); // draw this many vertices.

  
  //------------Draw Body
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0,-0.4);
  modelMatrix.translate(0,-0.4,0);
  pushMatrix(modelMatrix);

  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(0.3*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,0.02,0);
  modelMatrix.scale(0.25,0.25,0.25);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(-0.3*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,-0.02,0);
  modelMatrix.scale(0.25,0.25,0.25);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.5,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(90.0,1,0,0);
  modelMatrix.scale(0.25,0.25,0.25);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  modelMatrix = popMatrix();
  modelMatrix.translate(0,-0.1,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0,1,0,0);
  modelMatrix.rotate(0.3*currentAngle, 0,-0.4, 1);
  modelMatrix.scale(0.15,0.15,0.15);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(0.8,0.8,0.8);
  modelMatrix.rotate(0.7*currentAngle, 0, -0.4, 1);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0, 0,1,0);
  modelMatrix.rotate(-0.3*currentAngle, 0, -0.4, 1);
  modelMatrix.scale(0.15,0.15,0.15);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(0.8,0.8,0.8);
  modelMatrix.rotate(-0.7*currentAngle, 0, -0.4, 1);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);


  //----------Draw Head
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.2,0);
  modelMatrix.scale(0.6,0.6,0.6);
  modelMatrix.rotate(180.0,0,1,0);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

}

// Last time that this function was called:  (used for animation timing)
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
/*
function colorChange(color) {
//==============================================================================
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now;
  
  // Update the current rotation angle (adjusted by the elapsed time)
  //  limit the angle to move smoothly between +20 and -85 degrees:
//if(color >  1.0 && COLOR_STEP > 0) COLOR_STEP = -COLOR_STEP;
//if(color <  0.0 && COLOR_STEP < 0) COLOR_STEP = -COLOR_STEP;
  
  var newColor = color + (COLOR_STEP * elapsed);
  newColor = newColor- Math.floor(newColor);
  return newColor;
}
*/
function angleSubmit() {
// Called when user presses 'Submit' button on our webpage
//    HOW? Look in HTML file (e.g. ControlMulti.html) to find
//  the HTML 'input' element with id='usrAngle'.  Within that
//  element you'll find a 'button' element that calls this fcn.

// Read HTML edit-box contents:
  var UsrTxt=document.getElementById('usrAngle').value; 
// Display what we read from the edit-box: use it to fill up
// the HTML 'div' element with id='Result':
  document.getElementById('Result').innerHTML ='You Typed: '+UsrTxt;
};

function reset() {
// Called when user presses 'Clear' button in our webpage
  xMdragTot = 0.0;
  yMdragTot = 0.0;
  keyMovex=0.0;
  keyMovey=0.0;
  ANGLE_STEP=45.0;
}


//==================HTML Button Callbacks
function spinUp() {
  ANGLE_STEP = ANGLE_STEP*1.3; 
}

function spinDown() {
 ANGLE_STEP = ANGLE_STEP*0.8; 
}

function runStop() {
  if(ANGLE_STEP*ANGLE_STEP > 1) {
    myTmp = ANGLE_STEP;
    ANGLE_STEP = 0;
  }
  else {
    ANGLE_STEP = myTmp;
  }
  /*
  if(COLOR_STEP*COLOR_STEP > 1) {
    myTmp = COLOR_STEP;
    COLOR_STEP = 0;
  }
  else {
    COLOR_STEP = myTmp;
  }
  */
}
 
function myMouseDown(ev, gl, canvas) {
//==============================================================================
// Called when user PRESSES down any mouse button;
//                  (Which button?    console.log('ev.button='+ev.button);   )
//    ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//    pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left;                  // x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
 console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);
  
  // Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  /    // move origin to center of canvas and
               (canvas.width/2);      // normalize canvas to -1 <= x < +1,
  var y = (yp - canvas.height/2) /    //                     -1 <= y < +1.
               (canvas.height/2);
  console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
  
  isDrag = true;                      // set our mouse-dragging flag
  xMclik = x;                         // record where mouse-dragging began
  yMclik = y;
  runStop();
};


function myMouseMove(ev, gl, canvas) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
//                  (Which button?   console.log('ev.button='+ev.button);    )
//    ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//    pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

  if(isDrag==false) return;       // IGNORE all mouse-moves except 'dragging'

  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left;                  // x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
  
  // Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  /    // move origin to center of canvas and
               (canvas.width/2);      // normalize canvas to -1 <= x < +1,
  var y = (yp - canvas.height/2) /    //                     -1 <= y < +1.
               (canvas.height/2);
 console.log('myMouseMove(CVV coords  ):  x, y=\t',x,',\t',y);

  // find how far we dragged the mouse:
  xMdragTot += (x - xMclik);          // Accumulate change-in-mouse-position,&
  yMdragTot += (y - yMclik);
  xMclik = x;                         // Make next drag-measurement from here.
  yMclik = y;
};

function myMouseUp(ev, gl, canvas) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
//                  (Which button?   console.log('ev.button='+ev.button);    )
//    ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//    pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left;                  // x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
  
  // Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  /    // move origin to center of canvas and
               (canvas.width/2);      // normalize canvas to -1 <= x < +1,
  var y = (yp - canvas.height/2) /    //                     -1 <= y < +1.
               (canvas.height/2);
  console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
  
  isDrag = false;                     // CLEAR our mouse-dragging flag, and
  // accumulate any final bit of mouse-dragging we did:
  xMdragTot += (x - xMclik);
  yMdragTot += (y - yMclik);
  console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);
};
function myKeyDown(ev) {
//===============================================================================
// Called when user presses down ANY key on the keyboard, and captures the 
// keyboard's scancode or keycode(varies for different countries and alphabets).
//  CAUTION: You may wish to avoid 'keydown' and 'keyup' events: if you DON'T 
// need to sense non-ASCII keys (arrow keys, function keys, pgUp, pgDn, Ins, 
// Del, etc), then just use the 'keypress' event instead.
//   The 'keypress' event captures the combined effects of alphanumeric keys and // the SHIFT, ALT, and CTRL modifiers.  It translates pressed keys into ordinary
// ASCII codes; you'll get the ASCII code for uppercase 'S' if you hold shift 
// and press the 's' key.
// For a light, easy explanation of keyboard events in JavaScript,
// see:    http://www.kirupa.com/html5/keyboard_events_in_javascript.htm
// For a thorough explanation of the messy way JavaScript handles keyboard events
// see:    http://javascript.info/tutorial/keyboard-events
//

  switch(ev.keyCode) {      // keycodes !=ASCII, but are very consistent for 
  //  nearly all non-alphanumeric keys for nearly all keyboards in all countries.
    case 37:    // left-arrow key
      // print in console:
      console.log(' left-arrow.');
      // and print on webpage in the <div> element with id='Result':
      /*
      document.getElementById('Result').innerHTML =
        ' Left Arrow:keyCode='+ev.keyCode;
        */
      keyMovex -= 0.1;
      break;
    case 38:    // up-arrow key
      console.log('   up-arrow.');
      /*
      document.getElementById('Result').innerHTML =
        '   Up Arrow:keyCode='+ev.keyCode;
      */
      keyMovey += 0.1;
      break;
    case 39:    // right-arrow key
      console.log('right-arrow.');
      /*
      document.getElementById('Result').innerHTML =
        'Right Arrow:keyCode='+ev.keyCode;
        */
      keyMovex += 0.1;
      break;
    case 40:    // down-arrow key
      console.log(' down-arrow.');
      /*
      document.getElementById('Result').innerHTML =
        ' Down Arrow:keyCode='+ev.keyCode;
        */
        keyMovey -= 0.1;
      break;
    case 112:    // down-arrow key
      console.log(' F1.');
      document.getElementById('Help1').innerHTML= 'Click on the animation to run/stop it. Drag with mouse to change the angle of view.';
      document.getElementById('Help2').innerHTML= 'Press up/down/left/right-arrow key to move the objects.';
      document.getElementById('Help3').innerHTML= 'Click "Run/Stop" button to run or stop the animation. Click "Spin <<"/"Spin >>" button to speed down/up the animation.';
      document.getElementById('Help4').innerHTML= 'Click "Reset" button to restore the default angle, location and speed.';
      /*
      document.getElementById('Result').innerHTML =
        ' Down Arrow:keyCode='+ev.keyCode;
        */
      break;
    default:
      console.log('myKeyDown()--keycode=', ev.keyCode, ', charCode=', ev.charCode);
      /*
      document.getElementById('Result').innerHTML =
        'myKeyDown()--keyCode='+ev.keyCode;
        */
      break;
  }
}

function myKeyUp(ev) {
//===============================================================================
// Called when user releases ANY key on the keyboard; captures scancodes well

  console.log('myKeyUp()--keyCode='+ev.keyCode+' released.');
}

function myKeyPress(ev) {
//===============================================================================
// Best for capturing alphanumeric keys and key-combinations such as 
// CTRL-C, alt-F, SHIFT-4, etc.
  console.log('myKeyPress():keyCode='+ev.keyCode  +', charCode=' +ev.charCode+
                        ', shift='    +ev.shiftKey + ', ctrl='    +ev.ctrlKey +
                        ', altKey='   +ev.altKey   +
                        ', metaKey(Command key or Windows key)='+ev.metaKey);
}