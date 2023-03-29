// Model-View Matrix: Orthographic Projection Demo (solution)
'use strict';

// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;


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
    updateModelViewMatrix();
    updateProjectionMatrix();
    updateLightPosition();
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
            vEyeVector = -P.xyz;
            gl_Position = uProjectionMatrix * P;
        }`
    );
    // Fragment Shader
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
                uLightDiffuse * uMaterialDiffuse * diffuse + 
                uLightSpecular * uMaterialSpecular * specular;
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
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
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
            let positions = Float32Array.from(raw_model.vertices);
            let posBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW); // load the data into the buffer
            gl.vertexAttribPointer(gl.program.aPosition, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
            gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

            // Load the vertex normal data onto the GPU and associate with attribute
            let normals = calc_normals(positions, raw_model.indices, false);
            let normalBuffer = gl.createBuffer(); // create a new buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); // bind to the new buffer
            gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW); // load the data into the buffer
            gl.vertexAttribPointer(gl.program.aNormal, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
            gl.enableVertexAttribArray(gl.program.aNormal); // enable this set of data
            
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
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
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
    for (let name of ['rotation', 'translation', 'scale', 'origin']) {
        for (let axis of ['x', 'y', 'z']) {
            document.getElementById(name + '-' + axis).addEventListener('input', updateModelViewMatrix);
        }
    }
    document.getElementById('left').addEventListener('input', updateProjectionMatrix);
    document.getElementById('right').addEventListener('input', updateProjectionMatrix);
    document.getElementById('top').addEventListener('input', updateProjectionMatrix);
    document.getElementById('bottom').addEventListener('input', updateProjectionMatrix);
    document.getElementById('near').addEventListener('input', updateProjectionMatrix);
    document.getElementById('far').addEventListener('input', updateProjectionMatrix);
}


/**
 * Updates the position of the light from the inputs.
 */
function updateLightPosition() {
    gl.uniform4f(gl.program.uLight,
        +document.getElementById('light-x').value,
        +document.getElementById('light-y').value,
        +document.getElementById('light-z').value,
        document.getElementById('light-w').checked);
}


/**
 * Updates the model-view matrix with a rotation, translation, scale, and origin.
 */
function updateModelViewMatrix() {
    // Update model-view matrix uniform
    let mv = mat4.fromRotationTranslationScaleOrigin(mat4.create(),
        quat.fromEuler(quat.create(), ...getXYZ('rotation')),
        getXYZ('translation'), getXYZ('scale'), getXYZ('origin')
    );
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);

    // This updates the HTML display of the model-view matrix
    for (let i = 0; i < mv.length; i++) {
        document.getElementById('mv'+(i+1)).innerText = mv[i].toFixed(2);
    }
}


/**
 * Updates the projection matrix.
 */
function updateProjectionMatrix() {
    let left = +document.getElementById('left').value;
    let right = +document.getElementById('right').value;
    let bottom = +document.getElementById('bottom').value;
    let top = +document.getElementById('top').value;
    let near = +document.getElementById('near').value;
    let far = +document.getElementById('far').value;

    // Update projection matrix uniform
    let p = mat4.ortho(mat4.create(), left, right, bottom, top, near, far);
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);

    // This updates the HTML display of the projection matrix
    for (let i = 0; i < p.length; i++) {
        document.getElementById('proj'+(i+1)).innerText = p[i].toFixed(2);
    }
}



/**
 * Gets the list of X, Y, and Z values for a particular name used in the inputs.
 */
function getXYZ(name) {
    return [
        +document.getElementById(name+'-x').value,
        +document.getElementById(name+'-y').value,
        +document.getElementById(name+'-z').value
    ];
}


/**
 * Keep the canvas sized to the window.
 */
function onWindowResize() {
    let [w, h] = [window.innerWidth, window.innerHeight];
    gl.canvas.width = w;
    gl.canvas.height = h;
    gl.viewport(0, 0, w, h);
    //updateProjectionMatrix(); // TODO
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
 *
 * Arguments:
 *    coords - a Float32Array with 3 values per vertex
 *    indices - a regular or typed array
 *    is_tri_strip - defaults to true which means the indices represent a triangle strip
 * Returns:
 *    Float32Array of the normals with 3 values per vertex
 */
function calc_normals(coords, indices, is_tri_strip) {
    if (is_tri_strip !== true && is_tri_strip !== false) { is_tri_strip = true; }
    
    // Start with all vertex normals as <0,0,0>
    let normals = new Float32Array(coords.length);

    // Get temporary variables
    let [N_face, V, U] = [vec3.create(), vec3.create(), vec3.create()];

    // Calculate the face normals for each triangle then add them to the vertices
    let inc = is_tri_strip ? 1 : 3; // triangle strips only go up by 1 index per triangle
    for (let i = 0; i < indices.length - 2; i += inc) {
        // Get the indices of the triangle and then get pointers its coords and normals
        let j = indices[i]*3, k = indices[i+1]*3, l = indices[i+2]*3;
        let A = coords.subarray(j, j+3), B = coords.subarray(k, k+3), C = coords.subarray(l, l+3);
        let NA = normals.subarray(j, j+3), NB = normals.subarray(k, k+3), NC = normals.subarray(l, l+3);

        // Compute normal for the A, B, C triangle and save to N_face (will need to use V and U as temporaries as well)
        vec3.cross(N_face, vec3.subtract(V, B, A), vec3.subtract(U, C, A));
        if (is_tri_strip && (i%2) !== 0) { // every other triangle in a strip is actually reversed
            vec3.negate(N_face, N_face);
        }

        // Add N_face to the 3 normals of the triangle: NA, NB, and NC
        vec3.add(NA, N_face, NA); // NA += N_face
        vec3.add(NB, N_face, NB);
        vec3.add(NC, N_face, NC);
    }

    // Normalize the normals
    for (let i = 0; i < normals.length; i+=3) {
        let N = normals.subarray(i, i+3);
        vec3.normalize(N, N);
    }

    // Return the computed normals
    return normals;
}
