// Renders many birds using instancing (solution)
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
    gl.clearColor(0.5, 0.8, 0.92, 1.0); // setup the background color with red, green, blue, and alpha

    // Initialize the WebGL program
    gl.program = initProgram();

    // Load models and wait for them all to complete
    Promise.all([
        loadModel('../2-Rendering/bird.json')
    ]).then(
        models => {
            // All models have now fully loaded
            gl.bird = models[0];
            render();
        }
    );
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

        const float scale = 0.3;

        in vec4 aPosition;
        uniform vec2 uPosition;
        
        void main() {
            gl_Position.xy = scale*aPosition.xy + uPosition.xy;
            gl_Position.zw = vec2(0, 1);
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
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute location for "aPosition"

    // Get the uniform indices
    program.uPosition = gl.getUniformLocation(program, 'uPosition'); // get the shader uniform location for "uPosition"
    program.uColor = gl.getUniformLocation(program, 'uColor'); // get the shader uniform location for "uColor"

    return program;
}


/**
 * Load a model from a file into a VAO and return the VAO.
 */
function loadModel(filename) {
    return fetch(filename)
        .then(r => r.json())
        .then(raw_model => {
            // Create and bind the VAO
            let vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            
            // Load the vertex coordinate data onto the GPU and associate with attribute
            let posBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
            gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(raw_model.vertices), gl.STATIC_DRAW); // load the data into the buffer
            gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
            gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

            // Load the index data onto the GPU
            let indBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indBuffer); // bind to the new buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(raw_model.indices), gl.STATIC_DRAW); // load the data into the buffer
            
            // Cleanup
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            // Return the VAO and number of indices
            return [vao, raw_model.indices.length];
        })
        .catch(console.error);
}


/**
 * Render the scene.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    let [vao, count] = gl.bird;
    gl.bindVertexArray(vao);
    
    // Draw many birds of different colors and positions
    for (let i = 0; i < 5; i++) {
        gl.uniform2f(gl.program.uPosition, Math.random()*2 - 1, Math.random()*2 - 1);
        gl.uniform4f(gl.program.uColor, Math.random(), Math.random(), Math.random(), 1);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindVertexArray(null);
}
