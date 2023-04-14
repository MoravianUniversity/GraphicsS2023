// A demo of various aspects of blending model (solution)
'use strict';

// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

// Global WebGL context variable
let gl;

// Objects to be drawn
let objs = [];


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
    gl.clearColor(0, 0, 0, 0); // setup the background color with red, green, blue, and alpha
    updateDepthTest();
    updateCulling();
    updateBlending();

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    initEvents();

    // Set initial values of uniforms
    let view = glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), [0, 0, -5]);
    gl.uniformMatrix4fv(gl.program.uViewMatrix, false, view);

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

        // Matrices
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform mat4 uProjectionMatrix;

        // Light Position
        const vec4 light = vec4(0, 0, 5, 1);

        // Attributes for the vertex (from VBOs)
        in vec4 aPosition;
        in vec3 aNormal;

        // Vectors (varying variables to vertex shader)
        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        void main() {
            mat4 mv = uViewMatrix * uModelMatrix;
            vec4 P = mv * aPosition;

            vNormalVector = mat3(mv) * aNormal;
            vec4 lightPos = uViewMatrix * light;
            vLightVector = lightPos.w == 1.0 ? P.xyz - lightPos.xyz : lightPos.xyz;
            vEyeVector = -P.xyz;

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
        const float materialSpecular = 0.3;
        const float materialShininess = 10.0;

        // Vectors (varying variables from vertex shader)
        in vec3 vNormalVector;
        in vec3 vLightVector;
        in vec3 vEyeVector;

        // Output color
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
                specular = pow(max(dot(R, E), 0.0), materialShininess);
            }
            
            // Compute final color
            fragColor.rgb = lightColor * (
                (materialAmbient + materialDiffuse * diffuse) * uMaterialColor.rgb +
                materialSpecular * specular);
            fragColor.a = uMaterialColor.a;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aNormal = gl.getAttribLocation(program, 'aNormal');

    // Get the uniform indices
    program.uViewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    program.uModelMatrix = gl.getUniformLocation(program, 'uModelMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    program.uMaterialColor = gl.getUniformLocation(program, 'uMaterialColor');

    return program;
}


/**
 * Initialize the data buffers.
 */
/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices, colors, and indices for a cube
    let cube_coords = [
        1, 1, 1, // A
        -1, 1, 1, // B
        -1, -1, 1, // C
        1, -1, 1, // D
        1, -1, -1, // E
        -1, -1, -1, // F
        -1, 1, -1, // G
        1, 1, -1, // H
    ];
    let cube_indices = [
        1, 2, 0, 2, 3, 0,
        7, 6, 1, 0, 7, 1,
        1, 6, 2, 6, 5, 2,
        3, 2, 4, 2, 5, 4,
        6, 7, 5, 7, 4, 5,
        0, 3, 7, 3, 4, 7,
    ];
    objs.push(createObject(cube_coords, cube_indices, false));
    objs[0].push('cube');
    objs[0].push(mat4.fromScaling(mat4.create(), [0.75, 0.75, 0.75]));

    // The vertices, colors, and indices for a tetrahedron
    let tetra_coords = [
        0, 0, 1,
        0, Math.sqrt(8/9), -1/3,
        Math.sqrt(2/3), -Math.sqrt(2/9), -1/3,
        -Math.sqrt(2/3), -Math.sqrt(2/9), -1/3,
    ];
    let tetra_indices = [1, 3, 0, 2, 1, 3];
    objs.push(createObject(tetra_coords, tetra_indices, true));
    objs[1].push('tetra');
    objs[1].push(mat4.fromTranslation(mat4.create(), [0.5, -0.5, -0.5]));
}

/**
 * Creates a VAO containing the coordinates, colors, and indices provided
 */
function createObject(coords, indices, is_tri_strip) {
    coords = Float32Array.from(coords);
    let normals = coords; //calc_normals(coords, indices, is_tri_strip);

    // Create and bind VAO
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Load the coordinate data into the GPU and associate with shader
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aPosition);

    // Load the normal data into the GPU and associate with shader
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aNormal);

    // Load the index data into the GPU
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(indices), gl.STATIC_DRAW);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Return the object information
    return [vao, indices.length, is_tri_strip ? gl.TRIANGLE_STRIP : gl.TRIANGLES];
}


/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    gl.canvas.addEventListener('mousedown', onMouseDown);
    document.getElementById('depth-testing').addEventListener('input', updateDepthTest);
    document.getElementById('culling').addEventListener('input', updateCulling);
    document.getElementById('blending').addEventListener('input', updateBlending);
    document.getElementById('src-factor').addEventListener('input', updateBlending);
    document.getElementById('dst-factor').addEventListener('input', updateBlending);
    // No events for the color/alpha boxes or render order - they are re-read every render
}



/**
 * Handle the click-and-drag to rotate the cube.
 */
let rotation = [0, 0, 0];
function onMouseDown(e) {
    e.preventDefault();

    let [startX, startY] = [e.offsetX, e.offsetY];
    let start_rotation = rotation.slice();
    function onMouseMove(e2) {
        let x_rotation = (e2.offsetX - startX)/(this.width - 1) * 360;
        let y_rotation = (e2.offsetY - startY)/(this.height - 1) * 360;
        rotation[0] = start_rotation[0] + y_rotation;
        rotation[1] = start_rotation[1] + x_rotation;
        let view = glMatrix.mat4.fromRotationTranslation(glMatrix.mat4.create(),
            glMatrix.quat.fromEuler(glMatrix.quat.create(), ...rotation), [0, 0, -5]);
        gl.uniformMatrix4fv(gl.program.uViewMatrix, false, view);
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
 * Update the depth-testing from HTML inputs.
 */
function updateDepthTest() {
    if (document.getElementById('depth-testing').checked) {
        gl.enable(gl.DEPTH_TEST);
    } else {
        gl.disable(gl.DEPTH_TEST);
    }
}


/**
 * Update the culling from HTML inputs.
 */
function updateCulling() {
    let culling = document.getElementById('culling').value;
    if (culling === "NONE") {
        gl.disable(gl.CULL_FACE);
    } else {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl[culling]);
    }
}


/**
 * Update the alpha blending from HTML inputs.
 */
function updateBlending() {
    if (document.getElementById('blending').checked) {
        gl.enable(gl.BLEND);
    } else {
        gl.disable(gl.BLEND);
    }
    gl.blendFunc(
        gl[document.getElementById('src-factor').value],
        gl[document.getElementById('dst-factor').value]
    );
}


/**
 * Update the projection matrix.
 */
function updateProjectionMatrix() {
    let aspect = gl.canvas.width / gl.canvas.height;
    let p = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 10);
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);
}


/**
 * Keep the canvas sized to the window.
 */
function onWindowResize() {
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    updateProjectionMatrix();
}


/**
 * Render the scene. Must be called once and only once. It will call itself again.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let render_order = document.getElementById("render-order").value.split(',').map(x => parseInt(x, 10));
    for (let i of render_order) {
        let [vao, count, mode, name, model_matrix] = objs[i];
        gl.bindVertexArray(vao);
        gl.uniform4fv(gl.program.uMaterialColor, getColor(name));
        gl.uniformMatrix4fv(gl.program.uModelMatrix, false, model_matrix);
        gl.drawElements(mode, count, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindVertexArray(null);
    window.requestAnimationFrame(render);
}


/**
 * Get a color and alpha from a pair of HTML elements.
 */
function getColor(id) {
    let color = document.getElementById(id+'-color').value;
    let alpha = +document.getElementById(id+'-alpha').value;
    return Float32Array.of(
        parseInt(color.substr(1, 2), 16) / 255.0,
        parseInt(color.substr(3, 2), 16) / 255.0,
        parseInt(color.substr(5, 2), 16) / 255.0,
        alpha
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
    let N_face = vec3.create();
    let V = vec3.create();
    let U = vec3.create();

    // Calculate the face normals for each triangle then add them to the vertices
    for (let i = 0; i < indices.length - 2; i += 3) {
        // Get the indices of the triangle and then get pointers its positions and normals
        let j = indices[i]*3, k = indices[i+1]*3, l = indices[i+2]*3;
        let A = positions.subarray(j, j+3), B = positions.subarray(k, k+3), C = positions.subarray(l, l+3);
        let NA = normals.subarray(j, j+3), NB = normals.subarray(k, k+3), NC = normals.subarray(l, l+3);

        // Compute normal for the A, B, C triangle and save to N_face (will need to use V and U as temporaries as well)
        vec3.subtract(V, B, A);
        vec3.subtract(U, C, A);
        vec3.cross(N_face, V, U);

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
