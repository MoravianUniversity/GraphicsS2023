// This is a WebGL example that demonstrates basic hierarchial modeling with
// a robot arm.
'use strict';

// Global WebGL context variable
let gl;

// Temporary model view matrix used during rendering
const modelViewMatrix = mat4.create();

// Description of model
const BASE_HEIGHT = 0.2;
const ARM1_LENGTH = 0.3;
const ARM2_LENGTH = 0.1;
const BASE_ANGLE = 1; // rotates around y
const ARM1_ANGLE = 0; // rotates around x
const ARM2_ANGLE = 2; // rotates around z
let base = {
    // Robot Arm base - if the base rotates then everything rotates
    'position': [0, -BASE_HEIGHT/2, 0],
    'rotation': [0, 0, 0],
    'scale': [1, 1, 1],
    'origin': [0, 0, 0],
    'transform': mat4.create(),
    'color': [1, 0, 0, 1],
    'start': 0,
    'count': 0,
};
let lower = {
    // First part of the robot arm
    'position': [0, BASE_HEIGHT/2 + ARM1_LENGTH/2, 0],
    'rotation': [0, 0, 0],
    'scale': [1, 1, 1],
    'origin': [0, -ARM1_LENGTH/2, 0],
    'transform': mat4.create(),
    'color': [0, 1, 0, 1],
    'start': 0,
    'count': 0,
};
let upper = {
    // Second part of the robot arm
    'position': [0, (ARM1_LENGTH + ARM2_LENGTH)/2, 0], 
    'rotation': [0, 0, 45],
    'scale': [1, 1, 1],
    'origin': [0, -ARM2_LENGTH/2, 0],
    'transform': mat4.create(),
    'color': [0, 0, 1, 1],
    'start': 0,
    'count': 0,
};

// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2', {premultipliedAlpha:false});
    if (!gl) { window.alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // setup the background color with red, green, blue, and alpha
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // Initialize the WebGL program and data
    gl.program = initProgram();
    gl.vao = initBuffers();
    onWindowResize();
    initEvents();
    
    // Set initial values of uniforms
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mat4.create());
    gl.uniform4fv(gl.program.uLight, [5, 0, 10, 1]);
    base.rotation[BASE_ANGLE] = +document.getElementById('base-angle').value;
    lower.rotation[ARM1_ANGLE] = +document.getElementById('lower-angle').value;
    upper.rotation[ARM2_ANGLE] = +document.getElementById('upper-angle').value;
    updateTransformation(base);
    updateTransformation(lower);
    updateTransformation(upper);
    
    // Start rendering loop
    render();
});


/**
 * Create all of the buffers for the robot arm and return the VAO.
 */
function initBuffers() {
    // Create parts to use for all parts
    let vertices = [], normals = [], indices = [];
    [base.start, base.count] = cylinder(vertices, normals, indices, BASE_HEIGHT, 0.2);
    [lower.start, lower.count] = cube(vertices, normals, indices, [0.02, ARM1_LENGTH, 0.02]);
    [upper.start, upper.count] = cube(vertices, normals, indices, [0.02, ARM2_LENGTH, 0.02]);
    return createVAO(gl, gl.program, {
        "aPosition": [vertices, 3],
        "aNormal": [normals, 3],
    }, indices);
}


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
        uniform mat4 uProjectionMatrix;
        uniform vec4 uLight;

        in vec4 aPosition;
        in vec3 aNormal;

        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;
            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = uLight.w == 1.0 ? P.xyz - uLight.xyz : uLight.xyz;
            vEyeVector = P.xyz;
            gl_Position = uProjectionMatrix * P;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        // Light and material properties
        const vec3 lightColor = vec3(1, 1, 1);
        uniform vec4 uMaterialColor;
        const float materialAmbient = 0.2;
        const float materialDiffuse = 0.5;
        const float materialShininess = 10.0;

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

            // Compute lighting
            float diffuse = dot(-L, N);
            float specular = 0.0;
            if (diffuse < 0.0) {
                diffuse = 0.0;
            } else {
                vec3 R = reflect(L, N);
                specular = pow(max(dot(R, E), 0.0), materialShininess);
            }
            
            // Compute final color
            fragColor.rgb = lightColor * (
                (materialAmbient + materialDiffuse * diffuse) * uMaterialColor.rgb + specular
            );
            fragColor.a = uMaterialColor.a;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Don't need to get the attribute indices - they are retrieved later

    // Get the uniform indices
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    program.uMaterialColor = gl.getUniformLocation(program, 'uMaterialColor');
    program.uLight = gl.getUniformLocation(program, 'uLight');

    return program;
}

/**
 * Render the scene.
 */
function render() {
    // Clear
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Start the model view matrix from scratch
    let mv = mat4.identity(modelViewMatrix);

    // Draw each object
    // All objects use the same VAO but with different ranges of vertices
    gl.bindVertexArray(gl.vao);
    for (let obj of [base, lower, upper]) {
         // Add in this object's transformation
        // TODO

        // Upload model view matrix to the GPU
        // TODO

        // Update the color uniform
        gl.uniform4fv(gl.program.uMaterialColor, obj.color);

        // Draw the object using indices from start to start + count
        // TODO
    }
    gl.bindVertexArray(null);

    // Animate
    window.requestAnimationFrame(render);
}

/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);

    // Listen to sliders for the pieces
    document.getElementById('base-angle').addEventListener('input', function () {
        base.rotation[BASE_ANGLE] = +this.value;
        updateTransformation(base);
    });
    document.getElementById('lower-angle').addEventListener('input', function () {
        lower.rotation[ARM1_ANGLE] = +this.value;
        updateTransformation(lower);
    });
    document.getElementById('upper-angle').addEventListener('input', function () {
        upper.rotation[ARM2_ANGLE] = +this.value;
        updateTransformation(upper);
    });
}

/**
 * Update the transformation value in an object based on the 'rotation',
 * 'position', and 'scale' keys.
 */
function updateTransformation(obj) {
    // TODO: fill in obj.transform using the other obj keys
}

/**
 * Keep the canvas sized to the window.
 */
function onWindowResize() {
    let size = Math.min(window.innerWidth, window.innerHeight);
    gl.canvas.width = gl.canvas.height = size;
    gl.canvas.style.width = gl.canvas.style.height = size + 'px';
    gl.viewport(0, 0, size, size);
    updateProjectionMatrix();
}

/**
 * Updates the projection matrix.
 */
function updateProjectionMatrix() {
    let aspect = gl.canvas.width / gl.canvas.height;
    let p = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 10);
    mat4.translate(p, p, [0, -0.1, -1]); // move the camera back by 1 so origin is visible
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);
}
