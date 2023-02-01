// Renders a user-resizable circle
'use strict';
    
// Global WebGL context variable
let gl;

// Number of sides in the circle
const NUM_SIDES = 64;


// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2');
    if (!gl) { window.alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
    gl.clearColor(0.0, 0.0, 1.0, 1.0); // setup the background color with red, green, blue, and alpha amounts (this is white)
    
    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();

    // TODO: Add user-interaction events

    // Render the static scene
    render();
});


/**
 * Initializes the WebGL program.
 */
function initProgram() {
    // Compile shaders
    // Vertex Shader: simplest possible
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        in vec4 aPosition;
        
        void main() {
            gl_Position = aPosition;
        }`
    );
    // Fragment Shader: simplest possible, chosen color is red for each point
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        out vec4 fragColor;

        void main() {
            fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the position attribute index
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute "aPosition"
    
    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices of the circle
    let coords = [];
    circle(0, 0, 1, NUM_SIDES, coords);

    // Create and bind VAO
    gl.circleVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.circleVAO);

    // Load the vertex coordinate data onto the GPU and associate with attribute
    let posBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.STATIC_DRAW); // load the data into the buffer
    gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
    gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


/**
 * Render the scene.
 */
function render() {
    // Clear the current rendering
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // TODO: Draw the circle

    // Cleanup
    gl.bindVertexArray(null);
}


/**
 * Add the vertices for a circle centered at (cx, cy) with a radius of r and n sides to the
 * array coords.
 */
function circle(cx, cy, r, n, coords) {
    // The angle between subsequent vertices
    let theta = 2*Math.PI/n;

    // TODO: copy code from another circle example
}


function onClick(e) {
    // `this` refers to the element where you registered the event (in this case, the canvas)
    // `e.offsetX` and `e.offsetY` are the x and y position of the click within the canvas
    // `this.offsetWidth` and `this.offsetHeight` are the width and height of `this`
    let [x, y, w, h] = [e.offsetX, e.offsetY, this.offsetWidth, this.offsetHeight];

    // TODO: Convert x and y to clip coordinates

    // TODO: The new radius will be the distance of the clicked point (x,y) from the middle (0,0)
    let radius = TODO;

    // Compute the new circle radius
    let coords = [];
    circle(0, 0, radius, NUM_SIDES, coords);

    // TODO: Replace the data in the position buffer with the new coordinates

    // TODO: Cleanup

    // TODO: Render the updated scene
}
