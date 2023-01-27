// Renders a trapezoid (solution)
'use strict';
    
// Global WebGL context variable
let gl;

// Data buffers
let posBuffer, indBuffer;

// Attribute indices/locations
let aPosition;


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
    
    // The vertices of the trapezoid
    let coords = [-0.9, -0.9, -0.5, 0.9, 0, -0.9, 0.5, 0.9, 0.9, -0.9];
    let indices = [0, 2, 1, 1, 2, 3, 2, 4, 3];

    // TODO: Load the vertex coordinate data onto the GPU
    posBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.STATIC_DRAW); // load the data into the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, null); // cleanup

    // TODO: Load the index data onto the GPU
    indBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indBuffer); // bind to the new buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(indices), gl.STATIC_DRAW); // load the data into the buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // cleanup

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
    
    // TODO: Get the position attribute index
    aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute "aPosition"

    // Render the static scene
    render();
});

/**
 * Render the scene.
 */
function render() {
    // Clear the current rendering
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // TODO: Associate the position attribute with the position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the position buffer
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
    gl.enableVertexAttribArray(aPosition); // enable this set of data
    gl.bindBuffer(gl.ARRAY_BUFFER, null); // cleanup

    // TODO: draw the trapezoid
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indBuffer); // bind the element buffer to draw
    gl.drawElements(gl.TRIANGLES, 9, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // cleanup
}
