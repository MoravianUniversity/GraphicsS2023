// Renders a Solid Colored Triangle  (solution)
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
    initEvents();

    // Set initial values of uniforms
    gl.uniform4fv(gl.program.uColor, stringToColor(document.getElementById("color").value));

    // Render the static scene
    render();
});


/**
 * Initializes the WebGL program.
 */
function initProgram() {
    // Compile shaders
    // Vertex Shader
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        in vec4 aPosition;
        
        void main() {
            gl_Position = aPosition;
        }`
    );
    // Fragment Shader
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        uniform vec4 uColor;
        out vec4 fragColor;

        void main() {
            fragColor = uColor;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute "aPosition"

    // Get the uniform indices
    program.uColor = gl.getUniformLocation(program, 'uColor'); // get the uniform location for "uColor"
    
    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices and colors of the triangle
    let coords = [0, 1, -1, -1, 1, -1];

    //  Create and bind VAO
    gl.triangleVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.triangleVAO);

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
 * Initialize event handlers
 */
function initEvents() {
    document.getElementById("color").addEventListener("input", onColorChange);
}


/**
 * Render the scene.
 */
function render() {
    // Clear the current rendering
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Draw the triangle
    gl.bindVertexArray(gl.triangleVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
}


/**
 * When the color changes, update the uniform value and re-render.
 */
function onColorChange() {
    gl.uniform4fv(gl.program.uColor, stringToColor(this.value));
    render();
}


/**
 * Takes a color string (like "#89abcd") and returns to a 3 element Float32Array of red, green, and
 * blue amounts ranging from 0.0 to 1.0 each.
 */
function stringToColor(str) {
    return Float32Array.of(
        parseInt(str.substr(1, 2), 16) / 255.0,
        parseInt(str.substr(3, 2), 16) / 255.0,
        parseInt(str.substr(5, 2), 16) / 255.0,
        1
    );
}