// Sphere Demo
'use strict';


// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

// Global WebGL context variable
let gl;

// Global variables for the current position and rotation of the objects
let position = [0, 0, -5];
let rotation = [0, 0, 0];
let scale = [1, 1, 1];

// The object to draw
let obj;


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
    updateModelViewMatrix();

    // Render the scene
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
        uniform mat4 uProjectionMatrix;
        const vec4 light = vec4(0, 0, 5, 1);

        in vec4 aPosition;
        in vec3 aNormal;

        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;
            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vec4 L = uModelViewMatrix * light;
            vLightVector = light.w == 1.0 ? P.xyz - L.xyz : L.xyz;
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
        const vec3 materialAmbient = vec3(0, 0.2, 0);
        const vec3 materialDiffuse = vec3(0, 0.5, 0);
        const float materialShininess = 100.0;

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
                specular = pow(max(dot(R, E), 0.0), materialShininess);
            }
            
            // Compute final color
            fragColor.rgb = lightColor * ((materialAmbient + materialDiffuse * diffuse) + specular);
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

    return program;
}

/**
 * Initializes the buffers with a sphere object.
 */
function initBuffers() {
    let [coords, indices] = unit_sphere();
    obj = createObject(coords, indices);
}

/**
 * Creates a VAO containing the coordinates and indices provided.
 */
function createObject(coords, indices) {
    let normals = coords;

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
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Return the object information
    return [vao, indices.length];
}


/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    gl.canvas.addEventListener('wheel', onMouseWheel);
    gl.canvas.addEventListener('mousedown', onMouseDown);
}


/**
 * "Zoom" when using the mouse wheel.
 */
function onMouseWheel(e) {
    let s = scale[0] * Math.pow(1.05, e.deltaY);
    scale = [s, s, s];
    updateModelViewMatrix();
}


/**
 * Handle click-and-drag and click-and-rotate.
 */
function onMouseDown(e) {
    e.preventDefault();

    // Get the initial positions when the mouse goes down
    let [startX, startY] = [e.offsetX, e.offsetY];
    let start_rotation = rotation.slice();
    function get_delta(e2) {
        // Get the amount moved
        let x = (e2.offsetX - startX)/(gl.canvas.width - 1);
        let y = (e2.offsetY - startY)/(gl.canvas.height - 1);
        return [x, y];
    }
    function onMouseMove(e2) {
        let [x, y] = get_delta(e2);
        rotation[0] = start_rotation[0] + y * 360;
        rotation[1] = start_rotation[1] + x * 360;
        updateModelViewMatrix();
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
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    updateProjectionMatrix();
}


/**
 * Updates the model-view matrix from the globals position, rotation, and scale.
 */
function updateModelViewMatrix() {
    let mv = mat4.fromRotationTranslationScale(mat4.create(),
        quat.fromEuler(quat.create(), ...rotation), position, scale);
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);
}


/**
 * Updates the projection matrix.
 */
function updateProjectionMatrix() {
    let aspect = gl.canvas.width / gl.canvas.height;
    let p = mat4.perspective(mat4.create(), Math.PI / 6, aspect, 0.1, 10);
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);
}


/**
 * Render the scene. Must be called once and only once. It will call itself again.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let [vao, count] = obj;
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    window.requestAnimationFrame(render);
}


/**
 * Create an approximate unit sphere by subdividing the faces of a tetrahedron repeatedly. The
 * sphere will be centered at the origin and have a radius of 1. For different spheres the
 * vertices can just be transformed as necessary.
 * 
 * Returns the Float32Array of 3-element coordinates and Uint16Array of indices. The coordinates
 * are the same as the normals so that can just be reused.
 * 
 * Number of subdivisions is the only parameter and defaults to 7 which means that 65,536 triangles
 * are used to approximate the sphere which is the highest quality sphere this can generate. A
 * value of 0 would just give a tetrahedron (4 triangles) and 1 would give a 16-sided shape.
 */
function unit_sphere(num_subdivisions) {
    if (typeof num_subdivisions === "undefined") { num_subdivisions = 7; }

    let num_triangles = Math.pow(4, num_subdivisions); // number of triangles per face of tetrahedron
    let indices = new Uint16Array(12 * num_triangles);
    let coords = new Float32Array(6 * num_triangles + 6); // see https://oeis.org/A283070
    let indices_pos = 0, coords_pos = 0; // current position in each of the arrays
    let map = new Map();

    /**
     * Gets the index of the coordinate c. If c already exists than its previous index is
     * returned otherwise c is added and its new index is returned. The whole point of this
     * function (and the map variable) is so that duplicate coordinates get merged into a single
     * vertex.
     */
    function add_coord(c) {
        let str = c.toString();
        if (!map.has(str)) {
            map.set(str, coords_pos);
            coords.set(c, coords_pos*3);
            coords_pos++;
        }
        indices[indices_pos++] = map.get(str);
    }

    /**
     * Recursive function to continually divide a triangle similar to the Sierpinski's triangle
     * recursive function.
     */
    function divide_triangle(a, b, c, n) {
        if (n === 0) {
            // Base case: add the triangle
            add_coord(b);
            add_coord(a);
            add_coord(c);
        } else {
            // Get the midpoints
            let ab = vec3.lerp(vec3.create(), a, b, 0.5);
            let ac = vec3.lerp(vec3.create(), a, c, 0.5);
            let bc = vec3.lerp(vec3.create(), b, c, 0.5);

            // Recursively divide
            divide_triangle(a, ab, ac, n-1);
            divide_triangle(ab, b, bc, n-1);
            divide_triangle(ac, bc, c, n-1);
            divide_triangle(ab, bc, ac, n-1);
        }
    }

    // Initial tetrahedron to be divdied, 4 equidistant points at approximately:
    //    <0,0,-1>, <0,2*√2/3,1/3>, <-√6/3, -√2/3, 1/3>, and <√6/3, -√2/3, 1/3>
	let a = vec3.fromValues(0.0, 0.0, -1.0);
	let b = vec3.fromValues(0.0, 0.94280904158, 0.33333333333);
	let c = vec3.fromValues(-0.81649658093, -0.4714045207, 0.33333333333);
	let d = vec3.fromValues( 0.81649658093, -0.4714045207, 0.33333333333);
    
    // Subdivide each face of the tetrahedron
	divide_triangle(a, b, c, num_subdivisions);
	divide_triangle(d, c, b, num_subdivisions);
	divide_triangle(a, d, b, num_subdivisions);
    divide_triangle(a, c, d, num_subdivisions);

    // Normalize each vertex so that it is moved to the surface of the unit sphere
	for (let i = 0; i < coords.length; i += 3) {
        let coord = coords.subarray(i, i+3);
        vec3.normalize(coord, coord);
    }

    return [coords, indices];
}
