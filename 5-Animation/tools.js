// Various useful functions
/* exported loadModel loadModelAsVAO */
/* exported calcNormals */
/* exported createVAO createVBO createIBO */
/* exported cube tetrahedron */


// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;


/**
 * Load a model from a file into a list of vertices and indices to be later
 * uploaded to the GPU. Returns offset and number of indices.
 *
 * @param {string} filename 
 * @param {number[]} vertices
 * @param {number[]} normals
 * @param {number[]} indices
 * @returns {Promise<[number, number]>}
 */
function loadModel(filename, vertices, normals, indices) {
    return fetch(filename)
        .then(r => r.json())
        .then(raw_model => {
            let v_offset = vertices.length/3;
            let i_offset = indices.length;
            vertices.push(...raw_model.vertices);
            normals.push(...calcNormals(raw_model.vertices, raw_model.indices));
            indices.push(...raw_model.indices.map(x => x + v_offset));
            // Return the offset and number of indices
            return [i_offset, raw_model.indices.length];
        })
        .catch(console.error);
}

/**
 * Load a model from a file into its own VAO and return the VAO and number of indices.
 * Note that having one VAO per model can be expensive if there are lots of models.
 *
 * @param {string} filename 
 * @returns {Promise<[WebGLVertexArrayObject, number]>}
 */
function loadModelAsVAO(filename) {
    return fetch(filename)
        .then(r => r.json())
        .then(raw_model => {
            let vao = createVAO(gl, gl.program, {
                "aPosition": raw_model.vertices,
                "aNormal": calcNormals(positions, raw_model.indices),
            }, raw_model.indices)

            // Return the VAO and number of indices
            return [vao, raw_model.indices.length];
        })
        .catch(console.error);
}


/**
 * Calculates the normals for the vertices given an array of vertices and array of indices to look
 * up into.
 *
 * Arguments:
 *    coords - a Float32Array with 3 values per vertex
 *    indices - a regular or typed array
 *    is_tri_strip - defaults to false which means the indices represent full triangles
 * Returns:
 *    Float32Array of the normals with 3 values per vertex
 * 
 * @param {Float32Array|number[]|number[][]} coords
 * @param {Uint16Array|number[]} indices 
 * @param {boolean} [is_tri_strip] 
 * @returns {Float32Array}
 */
function calcNormals(coords, indices, is_tri_strip) {
    if (is_tri_strip !== true && is_tri_strip !== false) { is_tri_strip = false; }
    coords = asFloat32Array(coords);

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


/**
 * Create a VAO populated with VBOs associated with program attributes and
 * indices. The attributes are specified as an object where the keys are the
 * name of the attributes and the values are an array of the data for the
 * buffer and size of each attribute.
 * 
 * Example of use:
 *      let attributes = {
 *          "aPosition": [vertices, 3],
 *          "aNormal": [normals, 3],
 *      }
 *      createVAO(gl, gl.program, attributes, indices)
 * 
 * Returns the vertex array object allocated. All bindings are cleaned up.
 * 
 * @param {WebGL2RenderingContext} gl 
 * @param {WebGLProgram} program 
 * @param {Object} attributes 
 * @param {Uint16Array|number[]|number} indices 
 * @returns {WebGLVertexArrayObject}
 */
function createVAO(gl, program, attributes, indices) {
    // Create and bind the VAO
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Create the buffers
    for (const [attributeName, data_and_dim] of Object.entries(attributes)) {
        let [data, dim] = data_and_dim
        let attributeLoc = gl.getAttribLocation(program, attributeName)
        createVBO(gl, attributeLoc, data, dim);
    }
    createIBO(gl, indices);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return vao;
}


/**
 * Creates a vertex attribute buffer for the given attrib location. If x is an
 * array, it is used as the initial values in the buffer. Otherwise it must be
 * an integer and specifies the size of the buffer in number of vectors. dim is
 * the size of each vector (i.e 3 for a vec3).
 * 
 * Example:
 * createVBO(gl, gl.program.aPosition, verts, 3)
 * 
 * Returns the buffer id. The buffer remains bound.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {number} attribLoc
 * @param {Float32Array|number[]|number[][]|number} x
 * @param {number} dim
 * @returns {WebGLBuffer}
*/
function createVBO(gl, attribLoc, x, dim) {
    let data
    if (x instanceof Float32Array) {
        data = x
    } else if (Array.isArray(x)) {
        data = asFloat32Array(x);
    } else {
        data = x*dim*Float32Array.BYTES_PER_ELEMENT;
    }
    let bufferId = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); // load the flattened data into the buffer
    gl.vertexAttribPointer(attribLoc, dim, gl.FLOAT, false, 0, 0); // associate the buffer with the attributes making sure it knows its type
    gl.enableVertexAttribArray(attribLoc); // enable this set of data
    return bufferId;
}

/**
 * Creates an index buffer object. If x is an array, it is used as the initial
 * values in the buffer. Otherwise it must be an integer and specifies the size
 * of the buffer in number of indices.
 * 
 * Example:
 * createIBO(gl, indices)
 * 
 * Returns the buffer id. The buffer remains bound.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {Uint16Array|number[]|number} x
 * @returns {WebGLBuffer}
 */
function createIBO(gl, x) {
    let data
    if (x instanceof Uint16Array) {
        data = x
    } else if (Array.isArray(x)) {
        data = Uint16Array.from(x);
    } else {
        data = x*Uint16Array.BYTES_PER_ELEMENT;
    }
    let bufferId = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId); // bind to the new buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW); // load the data into the buffer
    return bufferId;
}


/**
 * Get an array as a Float32Array. The source can be one of Array of numbers,
 * nested Array of numbers, or a Float32Array already.
 * 
 * @param {Float32Array|number[]|number[][]} x
 * @returns {Float32Array}
 */
function asFloat32Array(x) {
    if (x instanceof Float32Array) { return x; }
    return Float32Array.from((Array.isArray(x[0])) ? x.flat() : x);
}


///////////// Shapes /////////////

/**
 * Adds a 1x1x1 cube centered at the origin to the given list of vertices,
 * normals, and indices. Should be drawn with TRIANGLES.
 * Note: even though this uses indices, vertices are duplicated to support
 * flat normals.
 * @param {number[]} vertices 
 * @param {number[]} normals 
 * @param {number[]} indices
 * @param {number|number[]} [size] size of each edge of the cube, default is [1,1,1]
 * @returns {[number, number]} the index offset and length for the cube
 */
function cube(vertices, normals, indices, size) {
    size = size || 1;
    if (!Array.isArray(size)) { size = [size, size, size]; }
    let x = size[0] / 2, y = size[1] / 2, z = size[2] / 2;
    let v_off = vertices.length/3;
    let i_off = indices.length;
    vertices.push(
        x, y, z, -x, y, z, -x, -y, z, // ABC
        x, y, z, -x, -y, z, x, -y, z, // ACD
        x, y, z, x, -y, z, x, y, -z, // ADH
        x, -y, z, x, -y, -z, x, y, -z, // DEH
        -x, -y, -z, -x, y, -z, x, y, -z, // FGH
        x, -y, -z, -x, -y, -z, x, y, -z, // EFH
        -x, y, z, -x, y, -z, -x, -y, z, // BGC
        -x, -y, -z, -x, -y, z, -x, y, -z, // FCG
        -x, y, z, x, y, -z, -x, y, -z, // BHG
        -x, y, z, x, y, z, x, y, -z, // BAH
        -x, -y, z, x, -y, -z, x, -y, z, // CED
        -x, -y, z, -x, -y, -z, x, -y, -z, // CFE
    );
    normals.push(
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
    );
    for (let i = 0; i < 36; i++) { indices.push(v_off + i); }
    return [i_off, 36];
}

/**
 * Adds a unit tetrahedron centered at the origin to the given list of
 * vertices, normals, and indices. Should be drawn with TRIANGLES.
 * @param {number[]} vertices 
 * @param {number[]} normals 
 * @param {number[]} indices 
 * @returns {[number, number]} the index offset and length for the tetrahedron
 */
function tetrahedron(vertices, normals, indices) {
    let v_off = vertices.length/3;
    let i_off = indices.length;
    let data = [
        0, 0, -1,
        0, Math.sqrt(8/9), 1/3,
        Math.sqrt(2/3), -Math.sqrt(2/9), 1/3,
        -Math.sqrt(2/3), -Math.sqrt(2/9), 1/3,
    ];
    vertices.push(...data);
    normals.push(...data);
    indices.push(
        v_off+3, v_off+1, v_off+0,
        v_off+2, v_off+0, v_off+1,
        v_off+0, v_off+3, v_off+2,
        v_off+1, v_off+2, v_off+3,
    );
    return [i_off, 12];
}


/**
 * Add the vertices for a circle centered at origin with a constant y-value of
 * y, a diameter of 1, and enough sides to be reasonable in most situations
 * (but can be specified with the final last argument). Should be drawn with
 * TRIANGLES.
 * @param {number[]} vertices 
 * @param {number[]} indices
 * @param {number} [diameter] diameter of the circle, defaults to 1
 * @param {number} [y] fixed y coordinate, defaults to 0
 * @param {number} [n] defaults to 64
 * @returns {[number, number]} the index offset and length for the circle
 */
function circle(vertices, indices, diameter, y, n) {
    diameter = diameter || 1.0;
    y = y || 0;
    n = n || 64;

    let v_off = vertices.length/3;
    let i_off = indices.length;

    // Add all of the vertices
    let theta = 2*Math.PI/n;
    let radius = diameter/2;
    vertices.push(0, y, 0);
    for (let i = 0; i < n; ++i) {
        vertices.push(radius*Math.cos(i*theta), y, radius*Math.sin(i*theta));
    }

    // Add all of the indices
    for (let i = 1; i < n; ++i) {
        indices.push(v_off, v_off + i, v_off + i + 1);
    }
    indices.push(v_off, v_off + n, v_off + 1);

    return [i_off, n*3];
}

/**
 * Add the vertices for a cylinder centered at origin.
 * Should be drawn with TRIANGLES.
 * @param {number[]} vertices 
 * @param {number[]} normals
 * @param {number[]} indices
 * @param {number} [height] height of the cylinder, defaults to 1
 * @param {number} [diameter] diameter of the cylinder, defaults to 1
 * @param {number} [n] sides to the cylinder, defaults to 64
 * @returns {[number, number]} the index offset and length for the cylinder
 */
function cylinder(vertices, normals, indices, height, diameter, n) {
    height = height || 1.0;
    diameter = diameter || 1.0;
    n = n || 64;

    let verts = [];
    let inds = [];

    // Top circle
    circle(verts, inds, diameter, -height/2, n);

    // Bottom circle
    let [start, total] = circle(verts, inds, diameter, height/2, n);

    // Bottom indices need reversing
    for (let i = start; i < start + total; i += 3) {
        const temp = inds[i];
        inds[i] = inds[i+1];
        inds[i+1] = temp;
    }

    // Connect the top and bottom
    // All vertices already exist, just need more indices
    // top (non-center) vertices are from 1 to n+1
    // bottom (non-center) vertices are from n+3 to 2n+2
    // triangles come in pairs:
    //   2, 1, n+2 and 2, n+2, n+3
    //   3, 2, n+3 and 3, n+3, n+4
    //   ...
    //   n, n-1, 2n and n, 2n, 2n+1
    //   1, 8, 2n+1 and 1, 2n+1, n+2
    for (let i = 1; i < n; i++) {
       inds.push(i+1, i, n+i+1);
       inds.push(i+1, n+i+1, n+i+2);
    }
    inds.push(1, n, n+n+1);
    inds.push(1, n+n+1, n+2);

    // Compute the normals
    norms = calcNormals(verts, inds);

    // Add the data to the master arrays
    let v_off = vertices.length/3;
    let i_off = indices.length;
    vertices.push(...verts);
    normals.push(...norms);
    indices.push(...inds.map(x => x + v_off));
    return [i_off, inds.length];
}
