// Renders a user-resizable circle (solution + slider + window resize + dragging + wheel + keys)
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
    gl.clearColor(0.0, 0.0, 1.0, 1.0); // setup the background color with red, green, blue, and alpha amounts
    
    // Initialize the WebGL program, data, user-interaction events
    gl.program = initProgram();
    initBuffers();
    initEvents();

    // Resize and render the canvas
    onWindowResize();
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
    gl.posBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.posBuffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.DYNAMIC_DRAW); // load the data into the buffer
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
    
    // Draw the circle
    gl.bindVertexArray(gl.circleVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.posBuffer);
    let count = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) / (Float32Array.BYTES_PER_ELEMENT * 2);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, count);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


/**
 * Add the vertices for a circle centered at (cx, cy) with a radius of r and n sides to the
 * array coords.
 */
function circle(cx, cy, r, n, coords) {
    // The angle between subsequent vertices
    let theta = 2*Math.PI/n;

    // Push the center vertex (all triangles share this one)
    coords.push(cx, cy);

    // Push the first coordinate around the circle
    coords.push(cx+r, cy);

    // Loop over each of the triangles we have to create
    for (let i = 1; i <= n; ++i) {
        // Push the next coordinate
        coords.push(cx+Math.cos(i*theta)*r, cy+Math.sin(i*theta)*r);
    }
}


/**
 * Set the radius of the circle, update the data on the GPU, and re-render.
 */
function setRadius(radius) {
    // Compute the new circle radius
    let coords = [];
    circle(0, 0, radius, NUM_SIDES, coords);

    // Replace the data in the position buffer with the new coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, Float32Array.from(coords));

    // Cleanup
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Update the slider bar (in case this was a click)
    let new_val = radius;
    if (document.getElementById("diameter").checked) {
        new_val *= 2;
    }
    document.getElementById("slider").value = new_val;

    // Render the updated scene
    render();
}


/**
 * Setup the user-interaction events.
 */
function initEvents() {
    gl.canvas.addEventListener('mousedown', onMouseDown);
    gl.canvas.addEventListener('wheel', onMouseWheel);
    document.getElementById('slider').addEventListener('input', onRadiusChange);
    document.getElementById('diameter').addEventListener('change', onRadiusChange);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
}


/**
 * When left mouse button is pressed down on the canvas we start listening for mouse movement
 * until mouse comes up.
 */
function onMouseDown(e) {
    if (e.button === 0) {
        e.preventDefault()
        gl.canvas.addEventListener('mousemove', onMouseMove);
        gl.canvas.addEventListener('mouseup', onMouseUp);
    }
}


/**
 * When the mouse moves (after mousedown) use mouse position to determine the radius and then
 * update the radius.
 */
function onMouseMove(e) {
    e.preventDefault();

    // Get mouse x and y in clip coordinates
    let [x, y] = [2*e.offsetX/(this.width-1)-1, 1-2*e.offsetY/(this.height-1)];

    // The new radius will be the distance of the clicked point (x,y) from the middle (0,0)
    setRadius(Math.sqrt(x*x + y*y));
}


/**
 * When mouse button is released remove the mousemove and mouseup events.
 */
function onMouseUp() {
    gl.canvas.removeEventListener('mousemove', onMouseMove);
    gl.canvas.removeEventListener('mouseup', onMouseUp);
}


/**
 * When mouse wheel is rotated change the radius.
 */
function onMouseWheel(e) {
    e.preventDefault()

    // Get the current radius first (the if statement only needed for diamter checkbox)
    let radius = +document.getElementById("slider").value;
    if (document.getElementById("diameter").checked) {
        radius /= 2;
    }
    // The Math.max(..., 0) prevents us from going negative
    setRadius(Math.max(radius - e.deltaY * 0.05, 0));
}


/**
 * When up or down arrows are pressed, change the radius of the circle.
 */
function onKeyDown(e) {
    e.preventDefault()

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // Get the current radius first (the if statement only needed for diamter checkbox)
        let radius = +document.getElementById("slider").value;
        if (document.getElementById("diameter").checked) {
            radius /= 2;
        }

        // Update radius
        if (e.key === "ArrowUp") {
            radius += 0.1;
        } else { // e.key === "ArrowDown"
            radius = Math.max(radius - 0.1, 0);
        }
        setRadius(radius);
    }
}


/**
 * When radius slider is changed (or the diameter checkbox changes) update the displayed radius.
 */
function onRadiusChange() {
    let radius = +document.getElementById("slider").value;
    if (document.getElementById("diameter").checked) {
        radius /= 2;
    }
    setRadius(radius);
}


/**
 * When the window resizes update the canvas width and height, the viewport, and re-render.
 */
function onWindowResize() {
    let [w, h] = [window.innerWidth, window.innerHeight - 40];
    gl.canvas.width = w;
    gl.canvas.height = h;
    gl.viewport(0, 0, w, h);
    render();
}
