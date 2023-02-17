// Renders a triangle tessellation with a twist transformation
'use strict';

// Global WebGL context variable
let gl;

const COUNT = 5;

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
    gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha

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
    // Vertex Shader
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        in vec4 aPosition;
        in vec4 aColor;
        out vec4 vColor;
        
        const float PI = 3.1415926535897932384626433832795;
        const float theta = PI / 3.0;
        
        void main() {
            // TODO: set gl_Position using a twist transformation based on theta (defined above)
            gl_Position = aPosition;
            vColor = aColor;
        }`
    );
    // Fragment Shader
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        in vec4 vColor;
        out vec4 fragColor;

        void main() {
            fragColor = vColor;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute location for "aPosition"
    program.aColor = gl.getAttribLocation(program, 'aColor'); // get the vertex shader attribute location for "aColor"

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices for the tesselated triangle (generated recursively)
    let coords = [];
    const SQRT3_2 = 0.866025404;
    tesselate([-SQRT3_2, -0.5], [0, 1], [SQRT3_2, -0.5], COUNT, coords);

    // The colors for the triangles (all red)
    let colors = [];
    const red = [1, 0, 0, 1];
    const grn = [0, 1, 0, 1];
    const blu = [0, 0, 1, 1];
    const blk = [0, 0, 0, 1];
    for (let i = 0; i < coords.length / 24; ++i) {
        colors.push(red, red, red, grn, grn, grn,
            blu, blu, blu, blk, blk, blk);
    }
    colors = colors.flat()

    // Create and bind VAO
    gl.vao = gl.createVertexArray();
    gl.bindVertexArray(gl.vao);

    // Load the vertex data into the GPU and associate with shader
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aPosition);

    // Load the vertex data into the GPU and associate with shader
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(colors), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aColor);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


/**
 * Render the scene.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(gl.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3*Math.pow(4, COUNT));
    gl.bindVertexArray(null);
}


/**
 * Generate the vertices for the triangle tesselation.
 * a, b, and c are the vertices of the overall triangle.
 * count is the number of iterations to do.
 * coords is the array of vertices to append the new vertices to.
 */
function tesselate(a, b, c, count, coords) {
    if (count === 0) {
        // Base case: add triangle vertices to array of coords
        coords.push(a[0], a[1], b[0], b[1], c[0], c[1]);
    } else {
        // Recursive case: divide triangle and recurse
        // Calculate midpoints of sides
        let ab = midpoint(a, b);
        let ac = midpoint(a, c);
        let bc = midpoint(b, c);
        // Recurse to each of the new triangles
        tesselate(a, ab, ac, count-1, coords);
        tesselate(ab, b, bc, count-1, coords);
        tesselate(ac, bc, c, count-1, coords);
        tesselate(bc, ac, ab, count-1, coords);
    }
}


/**
 * Computes the midpoint of two points. The two points are given as two-elements arrays.
 * Returns a two-element array for the computed midpoint.
 */
function midpoint(p, q) {
    return [(p[0]+q[0])*0.5, (p[1]+q[1])*0.5];
}
