// Teapot Demo
'use strict';

// Global WebGL context variable
let gl;

// Scale to draw the models at
let SCALE = [1, 1, 1];


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
    //gl.enable(gl.CULL_FACE);

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initEvents();

    // Load models and wait for them all to complete
    Promise.all([
        loadModel('teapot.json'),
    ]).then(
        models => {
            // All models have now fully loaded
            // Now we can add user interaction events and render the scene
            // The provided models is an array of all of the loaded models
            // Each model is a VAO and a number of indices to draw
            gl.models = models;
            onWindowResize();
            initEvents();
            render();
        }
    );

    // Set initial values of uniforms
    let mv = glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(),
        glMatrix.quat.create(), [0, 0, 0], SCALE);
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);
    updateLightPosition();
    updateLightAttenuation();
    gl.uniform3fv(gl.program.uLightAmbient, stringToColor(document.getElementById("light-ambient").value));
    gl.uniform3fv(gl.program.uLightDiffuse, stringToColor(document.getElementById("light-diffuse").value));
    gl.uniform3fv(gl.program.uLightSpecular, stringToColor(document.getElementById("light-specular").value));
    gl.uniform3fv(gl.program.uMaterialAmbient, stringToColor(document.getElementById("material-ambient").value));
    gl.uniform3fv(gl.program.uMaterialDiffuse, stringToColor(document.getElementById("material-diffuse").value));
    gl.uniform3fv(gl.program.uMaterialSpecular, stringToColor(document.getElementById("material-specular").value));
    gl.uniform1f(gl.program.uMaterialShininess, +document.getElementById("shininess").value);
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
        uniform vec4 uLight;

        in vec4 aPosition;
        in vec3 aNormal;

        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;
            P.z *= 0.1; // hack until we learn about projection

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = uLight.w == 1.0 ? P.xyz - uLight.xyz : uLight.xyz;
            vEyeVector = -P.xyz;

            gl_Position = P;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        // Light and material properties
        uniform vec3 uLightAmbient;
        uniform vec3 uLightDiffuse;
        uniform vec3 uLightSpecular;
        uniform vec3 uMaterialAmbient;
        uniform vec3 uMaterialDiffuse;
        uniform vec3 uMaterialSpecular;
        uniform float uMaterialShininess;
        uniform vec3 uLightAttenuation;

        // Vectors (varying variables from vertex shader)
        in vec3 vNormalVector;
        in vec3 vLightVector;
        in vec3 vEyeVector;

        out vec4 fragColor;

        void main() {
            // Normalize vectors
            vec3 N = normalize(vNormalVector);
            vec3 L = normalize(vLightVector);
            vec3 E = normalize(vEyeVector);

            float d = length(vLightVector);
            float attenuation = 1.0 / (uLightAttenuation[0] + uLightAttenuation[1] * d + uLightAttenuation[2] * d * d);

            // Compute lighting
            float diffuse = dot(-L, N);
            float specular = 0.0;
            if (diffuse < 0.0) {
                diffuse = 0.0;
            } else {
                vec3 R = reflect(L, N);
                specular = pow(max(dot(R, E), 0.0), uMaterialShininess);
            }
            
            // Compute final color
            fragColor.rgb =
                uLightAmbient * uMaterialAmbient +
                uLightDiffuse * uMaterialDiffuse * diffuse * attenuation + 
                uLightSpecular * uMaterialSpecular * specular * attenuation;
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
    program.uLightAttenuation = gl.getUniformLocation(program, 'uLightAttenuation');
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
 * Load a model from a file into a VAO and return the VAO.
 */
function loadModel(filename) {
    return TODO;
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
    document.getElementById('light-x').addEventListener('input', updateLightPosition);
    document.getElementById('light-y').addEventListener('input', updateLightPosition);
    document.getElementById('light-z').addEventListener('input', updateLightPosition);
    document.getElementById('light-w').addEventListener('input', updateLightPosition);
    document.getElementById('attenuation-a').addEventListener('input', updateLightAttenuation);
    document.getElementById('attenuation-b').addEventListener('input', updateLightAttenuation);
    document.getElementById('attenuation-c').addEventListener('input', updateLightAttenuation);

}

function updateLightPosition() {
    gl.uniform4f(gl.program.uLight,
        +document.getElementById('light-x').value,
        +document.getElementById('light-y').value,
        +document.getElementById('light-z').value,
        document.getElementById('light-w').checked);
}

function updateLightAttenuation() {
    gl.uniform3f(gl.program.uLightAttenuation,
        +document.getElementById('attenuation-a').value,
        +document.getElementById('attenuation-b').value,
        +document.getElementById('attenuation-c').value);
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
            qRotation, [0, 0, 0], SCALE);
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
    for (let [vao, count] of gl.models) {
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }
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

/**
 * Calculates the normals for the vertices given an array of vertices and array of indices to look
 * up into. The triangles are full triangles and not triangle strips.
 * The positions array must be a Float32Array with 3 values per vertex.
 * The indices can be a regular array or a typed array.
 * This returns a Float32Array of the normals with 3 values per vertex.
 */
function calc_normals(positions, indices) {
    // Start with all vertex normals as <0,0,0>
    let normals = new Float32Array(positions.length);

    // Allocate temporary variables
    let N_face = glMatrix.vec3.create();
    let V = glMatrix.vec3.create();
    let U = glMatrix.vec3.create();

    // Calculate the face normals for each triangle then add them to the vertices
    for (let i = 0; i < indices.length - 2; i += 3) {
        // Get the indices of the triangle and then get pointers its positions and normals
        let j = indices[i]*3, k = indices[i+1]*3, l = indices[i+2]*3;
        let A = positions.subarray(j, j+3), B = positions.subarray(k, k+3), C = positions.subarray(l, l+3);
        let NA = normals.subarray(j, j+3), NB = normals.subarray(k, k+3), NC = normals.subarray(l, l+3);

        // TODO: Compute normal for the A, B, C triangle and save to N_face (will need to use V and U as temporaries as well)
        
        // TODO: Add N_face to the 3 normals of the triangle: NA, NB, and NC
    }

    // Normalize the normals
    for (let i = 0; i < normals.length; i+=3) {
        let N = normals.subarray(i, i+3);
        glMatrix.vec3.normalize(N, N);
    }

    // Return the computed normals
    return normals;
}
