/*eslint no-redeclare: "off", no-unused-vars: "off" */

/**
 * Loads the file with the give name or path. The name can be relative or absolute. This loads the
 * file asynchronously. Once the file is loaded the `ondone` function is called. If the file fails
 * to load the `onerror` function is called.
 */
function loadFile(name, ondone, onerror) {
    let xhr = new XMLHttpRequest();
    xhr.addEventListener('load', ondone);
    xhr.addEventListener('error', onerror);
    xhr.open('GET', name, true);
    xhr.send(null);
}

/**
 * Compiles and checks the shader. The type must be one of the OpenGL constants for shaders like
 * gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
 */
function compileShader(gl, type, shader) {
    let shdr = gl.createShader(type);
    gl.shaderSource(shdr, shader);
    gl.compileShader(shdr);
    if (!gl.getShaderParameter(shdr, gl.COMPILE_STATUS)) {
        throw "Shader failed to compile. The error log is:<pre>" + gl.getShaderInfoLog(shdr) + "</pre>";
    }
    return shdr;
}

/**
 * Links multiple shaders into a program.
 */
function linkProgram(gl, ...shaders) {
    let program = gl.createProgram();
    for (let i = 0; i < shaders.length; ++i) {
        gl.attachShader(program, shaders[i]);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw "Shader program failed to link. The error log is:<pre>" + gl.getProgramInfoLog(program) + "</pre>";
    }
    return program;
}
