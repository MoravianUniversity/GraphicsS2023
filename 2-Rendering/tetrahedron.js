// Renders a tetrahedron
'use strict';
    
// Global WebGL context variable
let gl;


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
    gl.clearColor(1.0, 1.0, 1.0, 1.0); // setup the background color with red, green, blue, and alpha amounts (this is white)

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();

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
        in vec4 aColor;
        
        flat out vec4 vColor;

        void main() {
            gl_Position = aPosition;
            vColor = aColor;
        }`
    );
    // Fragment Shader: simplest possible, chosen color is red for each point
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        flat in vec4 vColor;
        out vec4 fragColor;

        void main() {
            fragColor = vColor;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the position attribute index
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute "aPosition"
    program.aColor = gl.getAttribLocation(program, 'aColor'); // get the vertex shader attribute "aColor"

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices and colors of a tetrahedron
    let coords = [
        0, 0, -1,
        0, Math.sqrt(8/9), 1/3,
        Math.sqrt(2/3), -Math.sqrt(2/9), 1/3,
        -Math.sqrt(2/3), -Math.sqrt(2/9), 1/3,
    ];
    let colors = [
        1, 0, 0, // red
        0, 1, 0, // green
        0, 0, 1, // blue
        0, 0, 0, // black
    ];
    let indices = [
        2, 0, 1,
        // TODO: green triangle
        // TODO: blue triangle
        // TODO: black triangle
    ];

    // Create and bind VAO
    gl.vao = gl.createVertexArray();
    gl.bindVertexArray(gl.vao);

    // Load the vertex coordinate data onto the GPU and associate with attribute
    let posBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.STATIC_DRAW); // load the data into the buffer
    gl.vertexAttribPointer(gl.program.aPosition, TODO, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-3 vectors of floats
    gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

    // Load the color data onto the GPU and associate with attribute
    let colorBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(colors), gl.STATIC_DRAW); // load the data into the buffer
    gl.vertexAttribPointer(gl.program.aColor, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "aColor" as length-3 vectors of floats
    gl.enableVertexAttribArray(gl.program.aColor); // enable this set of data
    
    // Load the indices onto the GPU and associate with attribute
    let indBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indBuffer); // bind to the new buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(indices), gl.STATIC_DRAW); // load the data into the buffer

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}


/**
 * Render the scene.
 */
function render() {
    // Clear the current rendering
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Draw tetrahedron
    gl.bindVertexArray(gl.vao);
    gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
}
