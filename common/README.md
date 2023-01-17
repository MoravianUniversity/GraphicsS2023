Common files to be included in HTML files before the project code.


utilities.js
============

Utilities to initialize shaders, including compiling and linking.

`loadFile(name, ondone, onerror)` - Loads a file asynchronously, calling either
`ondone` or `onerror` on completion. This function returns immediately. Inside
the called functions `this` is the `XMLHttpRequest` object (so
`this.responseText` is the file's contents).

`compileShader(gl, type, shader)` - Compiles and checks the shader. `gl` is a
WebGL context object, `type` must be one of the OpenGL constants for shaders
(like `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`), and `shader` is the code for
the shader.

`linkProgram(gl, shaders)` - Links several shaders into a WebGL program. `gl`
is a WebGL context object and `shaders` is an array of shaders returned by
`compileShader`.


gl-matrix.js
============

Matrix/vector package from [glmatrix.net](http://glmatrix.net/). The
documention is available at [glmatrix.net/docs](http://glmatrix.net/docs/) and
a tutorial at [math.hws.edu/graphicsbook/c7/s1.html#webgl3d.1.2](http://math.hws.edu/graphicsbook/c7/s1.html#webgl3d.1.2).
