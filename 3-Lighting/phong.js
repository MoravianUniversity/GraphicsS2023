// A demo of various aspects of the Phong lighting model
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
    gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    initEvents();

    // Set initial values of uniforms
    let mv = glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(),
        glMatrix.quat.create(), [0, 0, -1], [0.5, 0.5, 0.5]);
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);
    // TODO: *eventually* make 3 sliders for the light position in the HTML document and use those values here
    gl.uniform4f(gl.program.uLight, 0, 0, -25, 1);
    gl.uniform3fv(gl.program.uLightAmbient, stringToColor(document.getElementById("light-ambient").value));
    gl.uniform3fv(gl.program.uLightDiffuse, stringToColor(document.getElementById("light-diffuse").value));
    gl.uniform3fv(gl.program.uLightSpecular, stringToColor(document.getElementById("light-specular").value));
    gl.uniform3fv(gl.program.uMaterialAmbient, stringToColor(document.getElementById("material-ambient").value));
    gl.uniform3fv(gl.program.uMaterialDiffuse, stringToColor(document.getElementById("material-diffuse").value));
    gl.uniform3fv(gl.program.uMaterialSpecular, stringToColor(document.getElementById("light-specular").value));
    gl.uniform1f(gl.program.uMaterialShininess, +document.getElementById("shininess").value);

    // Render the static scene
    onWindowResize();
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

        uniform mat4 uModelViewMatrix;
        // TODO: add any uniforms that should be here

        in vec4 aPosition;
        in vec3 aNormal;

        out vec3 vNormalVector;
        // TODO: add other vectors

        void main() {
            vec4 P = uModelViewMatrix * aPosition;
            P.z *= 0.1; // hack until we learn about projection

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            // TODO: add other vectors
            gl_Position = P;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        // TODO: add any uniforms that should be here

        in vec3 vNormalVector;
        // TODO: add other vectors

        out vec4 fragColor;

        void main() {
            // TODO: normalize vectors

            // TODO: compute lighting
            
            // TODO: replace the vec3() on the next line with the final coloring
            fragColor.rgb = vec3(0, 0, 0);
            fragColor.a = 1.0;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aNormal = gl.getAttribLocation(program, 'aNormal');

    // Get the uniform indices
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uLight = gl.getUniformLocation(program, 'uLight');
    program.uLightAmbient = gl.getUniformLocation(program, 'uLightAmbient');
    program.uLightDiffuse = gl.getUniformLocation(program, 'uLightDiffuse');
    program.uLightSpecular = gl.getUniformLocation(program, 'uLightSpecular');
    program.uMaterialAmbient = gl.getUniformLocation(program, 'uMaterialAmbient');
    program.uMaterialDiffuse = gl.getUniformLocation(program, 'uMaterialDiffuse');
    program.uMaterialSpecular = gl.getUniformLocation(program, 'uMaterialSpecular');
    program.uMaterialShininess = gl.getUniformLocation(program, 'uMaterialShininess');

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices, normals, and indices for a cube
    // The vertices are duplicated so that the normals can be corrected for sharp corners
    let coords = [
        1, 1, 1, -1, 1, 1, -1, -1, 1, // ABC
        1, 1, 1, -1, -1, 1, 1, -1, 1, // ACD
        1, 1, 1, 1, -1, 1, 1, 1, -1, // ADH
        1, -1, 1, 1, -1, -1, 1, 1, -1, // DEH
        -1, -1, -1, -1, 1, -1, 1, 1, -1, // FGH
        1, -1, -1, -1, -1, -1, 1, 1, -1, // EFH
        -1, 1, 1, -1, 1, -1, -1, -1, 1, // BGC
        -1, -1, -1, -1, -1, 1, -1, 1, -1, // FCG
        -1, 1, 1, 1, 1, -1, -1, 1, -1, // BHG
        -1, 1, 1, 1, 1, 1, 1, 1, -1, // BAH
        -1, -1, 1, 1, -1, -1, 1, -1, 1, // CED
        -1, -1, 1, -1, -1, -1, 1, -1, -1, // CFE
    ];
    let normals = [
        0, 0, 1, 0, 0, 1, 0, 0, 1,
        0, 0, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 1, 0, 0,
        1, 0, 0, 1, 0, 0, 1, 0, 0,
        0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 0, -1, 0, 0, -1, 0, 0, -1,
        -1, 0, 0, -1, 0, 0, -1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0,
        0, -1, 0, 0, -1, 0, 0, -1, 0,
        0, -1, 0, 0, -1, 0, 0, -1, 0,
    ];

    // Create and bind VAO
    gl.vao = gl.createVertexArray();
    gl.bindVertexArray(gl.vao);

    // Load the coordinate data into the GPU and associate with shader
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aPosition);

    // Load the normal data into the GPU and associate with shader
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(normals), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aNormal);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}


/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    gl.canvas.addEventListener('mousedown', onMouseDown);
    document.getElementById('light-ambient').addEventListener('input', function () { gl.uniform3fv(gl.program.uLightAmbient, stringToColor(this.value)); });
    document.getElementById('light-diffuse').addEventListener('input', function () { gl.uniform3fv(gl.program.uLightDiffuse, stringToColor(this.value)); });
    document.getElementById('light-specular').addEventListener('input', function () { gl.uniform3fv(gl.program.uLightSpecular, stringToColor(this.value)); });
    document.getElementById('material-ambient').addEventListener('input', function () { gl.uniform3fv(gl.program.uMaterialAmbient, stringToColor(this.value)); });
    document.getElementById('material-diffuse').addEventListener('input', function () { gl.uniform3fv(gl.program.uMaterialDiffuse, stringToColor(this.value)); });
    document.getElementById('material-specular').addEventListener('input', function () { gl.uniform3fv(gl.program.uMaterialSpecular, stringToColor(this.value)); });
    document.getElementById('shininess').addEventListener('input', function () { gl.uniform1f(gl.program.uMaterialShininess, +this.value); });
    // TODO: *eventually* make 3 sliders for the light position in the HTML document and attach events here to update the uLight uniform
}


/**
 * Handle the click-and-drag to rotate the cube.
 */
let rotation = [0, 0, 0];
function onMouseDown(e) {
    let [startX, startY] = [e.offsetX, e.offsetY];
    let start_rotation = rotation.slice();
    function onMouseMove(e2) {
        let x_rotation = (e2.offsetX - startX)/(this.width - 1) * 360;
        let y_rotation = (e2.offsetY - startY)/(this.height - 1) * 360;
        rotation[0] = start_rotation[0] + y_rotation;
        rotation[1] = start_rotation[1] + x_rotation;
        let qRotation = glMatrix.quat.fromEuler(glMatrix.quat.create(), ...rotation);
        let mv = glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(),
            qRotation, [0, 0, -1], [0.5, 0.5, 0.5]);
        gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);
    }
    function onMouseUp() {
        this.removeEventListener('mousemove', onMouseMove);
        this.removeEventListener('mouseup', onMouseUp);
    }
    if (e.button === 0) {
        this.addEventListener('mousemove', onMouseMove);
        this.addEventListener('mouseup', onMouseUp);
    }
}


/**
 * Keep the canvas sized to the window.
 */
function onWindowResize() {
    let size = Math.min(window.innerWidth, window.innerHeight);
    gl.canvas.width = gl.canvas.height = size;
    gl.canvas.style.width = gl.canvas.style.height = size + 'px';
    gl.viewport(0, 0, size, size);
}


/**
 * Render the scene. Must be called once and only once. It will call itself again.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(gl.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6*2*3);
    gl.bindVertexArray(null);
    window.requestAnimationFrame(render);
}


/**
 * Takes a color string (like "#89abcd") and returns to a 3 element Float32Array of red, green, and
 * blue amounts ranging from 0.0 to 1.0 each.
 */
function stringToColor(str) {
    return Float32Array.of(
        parseInt(str.substr(1, 2), 16) / 255.0,
        parseInt(str.substr(3, 2), 16) / 255.0,
        parseInt(str.substr(5, 2), 16) / 255.0
    );
}