// A basic demo of cubemaps (solution)
'use strict';

// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

// Global WebGL context variable
let gl;

// View values
let position = [0, 0, -5];
let rotation = [0, 0, 0];
let scale = [1, 1, 1];

// Objects to be drawn
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
    gl.clearColor(0, 0, 0, 0); // setup the background color with red, green, blue, and alpha
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    let texture_promises = initTextures();
    initEvents();

    // Set initial values of uniforms
    updateModelViewMatrix();
    gl.uniform1i(gl.program.uTexture, 0);

    // Render the static scene
    onWindowResize();

    Promise.all(texture_promises).then(
        (textures) => {
            // After all images are loaded then we can continue
            obj.push(...textures);
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

        // Matrices
        uniform mat4 uModelViewMatrix;
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

        // Texture information
        out vec3 vTexCoord;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = light.w == 1.0 ? P.xyz - light.xyz : light.xyz;
            vEyeVector = -P.xyz;

            gl_Position = uProjectionMatrix * P;

            // TODO: Assign the texture coordinate as the position attribute (untransformed)
            vTexCoord = aPosition.xyz;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        // Light and material properties
        const vec3 lightColor = vec3(1, 1, 1);
        const vec4 materialColor = vec4(0, 1, 0, 1);
        const float materialAmbient = 0.2;
        const float materialDiffuse = 0.5;
        const float materialSpecular = 0.3;
        const float materialShininess = 10.0;

        // Vectors (varying variables from vertex shader)
        in vec3 vNormalVector;
        in vec3 vLightVector;
        in vec3 vEyeVector;

        // TODO: Texture information
        uniform samplerCube uTexture;
        in vec3 vTexCoord;

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
            
            // TODO: Object color combined from texture and material
            vec4 color = texture(uTexture, vTexCoord);

            // Compute final color
            fragColor.rgb = lightColor * (
                (materialAmbient + materialDiffuse * diffuse) * color.rgb +
                materialSpecular * specular);
            fragColor.a = 1.0;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aNormal = gl.getAttribLocation(program, 'aNormal');
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

    // Get the uniform indices
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices and indices for a sphere
    let [coords, indices] = unit_sphere();
    obj = createObject(coords, indices, false);
}


/**
 * Creates a VAO containing the coordinates, colors, and indices provided
 */
function createObject(coords, indices, is_tri_strip) {
    coords = Float32Array.from(coords);
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
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(indices), gl.STATIC_DRAW);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Return the object information
    return [vao, indices.length, is_tri_strip ? gl.TRIANGLE_STRIP : gl.TRIANGLES];
}


/**
 * Load a texture onto the GPU. The second argument is the texture number, defaulting to 0.
 */
function loadTexture(img, index) {
    // Default argument value
    if (typeof index === 'undefined') { index = 0; }

    let texture = gl.createTexture(); // create a texture resource on the GPU
    gl.activeTexture(gl['TEXTURE'+index]); // set the current texture that all following commands will apply to
    gl.bindTexture(gl.TEXTURE_2D, texture); // assign our texture resource as the current texture
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // tell WebGL to flip the image vertically (almost always want this to be true)

    // Load the image data into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    // Setup options for downsampling and upsampling the image data
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Cleanup and return
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}


/**
 * Load a cubemap texture onto the GPU as defined by 6 images. The last argument is the texture
 * number, defaulting to 0.
 */
function loadCubemapTexture(xp, xn, yp, yn, zp, zn, index) {
    // Default argument value
    if (typeof index === 'undefined') { index = 0; }

    let texture = gl.createTexture(); // create a texture resource on the GPU
    gl.activeTexture(gl['TEXTURE'+index]); // set the current texture that all following commands will apply to
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture); // assign our texture resource as the current texture
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // TODO: Load the image data into the texture
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, xp);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, xn);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, yp);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, yn);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, zp);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, zn);

    // Setup options for downsampling and upsampling the image data
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Cleanup and return
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return texture;
}


/**
 * Load an image file into a texture on the GPU. The second argument is the texture number,
 * defaulting to 0. Returns a Promise that resolves to the texture object.
 */
function loadImageAsCubemapTexture(img_url, index) {
    // Default argument value
    if (typeof index === 'undefined') { index = 0; }
    return new Promise(resolve => {
        const image = new Image();
        image.src = img_url;
        image.addEventListener('load', () => {
            // TODO: first load cubemap texture with same image on all sides
            // Then try loading front/back as checkerboard 2x2, left/right as checkerboard 2x2, and top/bottom as the image
            resolve(loadCubemapTexture(image, image, image, image, image, image, index));
        });
    });
}

/**
 * Initialize the texture buffers.
 */
function initTextures() {
    return [loadImageAsCubemapTexture('WebGL.png', 0)];
}


/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    gl.canvas.addEventListener('mousedown', onMouseDown);
    gl.canvas.addEventListener('wheel', onMouseWheel);
}


/**
 * Update the model view matrix.
 */
function updateModelViewMatrix() {
    let mv = glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(),
        glMatrix.quat.fromEuler(glMatrix.quat.create(), ...rotation), position, scale);
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);
}


/**
 * Handle the click-and-drag to rotate the cube.
 */
function onMouseDown(e) {
    e.preventDefault();

    let [startX, startY] = [e.offsetX, e.offsetY];
    let start_rotation = rotation.slice();
    function onMouseMove(e2) {
        let x_rotation = (e2.offsetX - startX) / (this.width - 1) * 360;
        let y_rotation = (e2.offsetY - startY) / (this.height - 1) * 360;
        rotation[0] = start_rotation[0] + y_rotation;
        rotation[1] = start_rotation[1] + x_rotation;
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
 * "Zoom" when using the mouse wheel.
 */
function onMouseWheel(e) {
    let s = scale[0] * Math.pow(1.05, e.deltaY);
    scale = [s, s, s];
    updateModelViewMatrix();
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

    let [vao, count, mode, texture] = obj;
    gl.bindVertexArray(vao);

    // Bind all textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    // Draw
    gl.drawElements(mode, count, gl.UNSIGNED_SHORT, 0);
    
    // Cleanup
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

    // Render again
    window.requestAnimationFrame(render);
}


/**
 * Create a checkerboard image of white and black squares. The image will be size-by-size pixels.
 * There will be a total of num_checks boxes in each direction for a total of num_checks^2.
 */
function createCheckerboardImage(size, num_checks) {
    let img = new ImageData(size, size);
    let data = img.data;
    let checkSize = size/num_checks;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            let off = 4*(i*size+j);
            let checkX = Math.floor(i/checkSize)%2;
            let checkY = Math.floor(j/checkSize)%2;
            let c = (checkX !== checkY) ? 255 : 0;
            data[off] = data[off+1] = data[off+2] = c;
            data[off+3] = 255;
        }
    }
    return img;
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
