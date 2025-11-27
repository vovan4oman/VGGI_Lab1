'use strict';


let gl;
let surface;
let shProgram;
let spaceball;
let zoom = 100.0;
let uMaxMultiplier = 2.5; 
let uSteps = 80; 
let vSteps = 80;
let renderMode = "fill";
let lightSphere;


function deg2rad(angle) { return angle * Math.PI / 180; }


function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer(); 
    this.iWireIndexBuffer = gl.createBuffer();
    this.indexCount = 0;
    this.primitive = gl.TRIANGLES;

    this.BufferData = function(vertices, indices, wireIndices, normals) { 
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STREAM_DRAW);
        this.fillIndexCount = indices.length;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iWireIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(wireIndices), gl.STREAM_DRAW);
        this.wireIndexCount = wireIndices.length;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        if (renderMode === "fill") {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
            gl.drawElements(gl.TRIANGLES, this.fillIndexCount, gl.UNSIGNED_SHORT, 0);
        } else { 
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iWireIndexBuffer);
            gl.drawElements(gl.LINES, this.wireIndexCount, gl.UNSIGNED_SHORT, 0);
        }
    }
}


function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1; 

    this.iProjectionMatrix = -1;  
    this.iModelViewMatrix = -1;     
    this.iNormalMatrix = -1;        
    this.iLightPosition = -1;    
    this.iWireframeColor = -1;    
    this.iRenderMode = -1;    

    this.Use = function() { gl.useProgram(this.prog); }
}


function draw() {
    requestAnimationFrame(draw);

    resizeCanvasToDisplaySize(gl.canvas);
    gl.clearColor(0,0,0,1); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    let projection = m4.perspective(Math.PI / 8, gl.canvas.clientWidth / gl.canvas.clientHeight, 5, 2000);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    
    let viewMatrix = spaceball.getViewMatrix();
    let rotateToVertical = m4.axisRotation([1, 0, 0], Math.PI / 2);
    viewMatrix = m4.multiply(rotateToVertical, viewMatrix);
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -zoom);
    viewMatrix = m4.multiply(rotateToPointZero, viewMatrix);
    viewMatrix = m4.multiply(translateToPointZero, viewMatrix);

    const time = performance.now() * 0.0005;
    const lightRadius = 10.0;
    const worldLightPos = [ 
        
        Math.cos(time) * lightRadius, 
        
        Math.sin(time) * lightRadius,
         -10.0,
        
    ];

    const viewLightPos = m4.transformPoint(viewMatrix, worldLightPos);
    gl.uniform3fv(shProgram.iLightPosition, viewLightPos);
    gl.uniform4fv(shProgram.iWireframeColor, [0.4, 0.8, 1.0, 1.0]); 

    
    gl.uniform1i(shProgram.iRenderMode, renderMode === "fill" ? 0 : 1);
    
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, viewMatrix);
    
    let surfaceNormalMatrix = m4.transpose(m4.inverse(viewMatrix));
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, surfaceNormalMatrix);
    
    surface.Draw();

    
    gl.uniform1i(shProgram.iRenderMode, 2);

    let sphereModelMatrix = m4.translation(worldLightPos[0], worldLightPos[1], worldLightPos[2]);
    
    let sphereModelViewMatrix = m4.multiply(viewMatrix, sphereModelMatrix);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, sphereModelViewMatrix);

    let sphereNormalMatrix = m4.transpose(m4.inverse(sphereModelViewMatrix));
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, sphereNormalMatrix);

    lightSphere.Draw();
}


function CreateSurfaceData() {
    let vertices = [];
    let indices = [];
    let wireIndices = [];
    let normals = [];

    let uMax = uMaxMultiplier * Math.PI;
    let vMin = -2 * Math.PI;
    let vMax = 2 * Math.PI;

    // --- Функція поверхні ---
    function P(u, v) {
        const scale = 0.6;
        const half = (0 <= u && u < Math.PI);
        const r = 4 * (1 - Math.cos(u) / 2);

        let x, y, z;

        if (half) {
            x = 6 * Math.cos(u) * (1 + Math.sin(u)) + r * Math.cos(u) * Math.cos(v);
            y = 16 * Math.sin(u) + r * Math.sin(u) * Math.cos(v);
        } else {
            x = 6 * Math.cos(u) * (1 + Math.sin(u)) + r * Math.cos(v + Math.PI);
            y = 16 * Math.sin(u);
        }

        z = r * Math.sin(v);
        return [scale * x, scale * y, scale * z];
    }

    
    // --- Генерація вершин ---
    for (let i = 0; i <= uSteps; i++) {
        let u = i * uMax / uSteps;
        for (let j = 0; j <= vSteps; j++) {
            let v = vMin + j * (vMax - vMin) / vSteps;
            vertices.push(...P(u, v));
        }
    }

    const numVertsV = vSteps + 1;

    // --- Генерація індексів та дротяного каркасу ---
    for (let i = 0; i < uSteps; i++) {
        const half = (i * uMax / uSteps < Math.PI);
        for (let j = 0; j < vSteps; j++) {
            let v00 = i * numVertsV + j;
            let v01 = i * numVertsV + (j + 1);
            let v10 = (i + 1) * numVertsV + j;
            let v11 = (i + 1) * numVertsV + (j + 1);

            if (half) {
                indices.push(v00, v10, v01);
                indices.push(v01, v10, v11);
            } else {
                indices.push(v00, v01, v10);
                indices.push(v01, v11, v10);
            }

            wireIndices.push(v00, v10, v10, v11, v11, v01, v01, v00);
        }
    }

    // --- Ініціалізація нормалей ---
    let numVertices = vertices.length / 3;
    let tempNormals = new Array(numVertices).fill(0).map(() => [0, 0, 0]);

    const getAngle = (a, b) => {
        const dot = m4.dot(m4.normalize(a), m4.normalize(b));
        return Math.acos(Math.max(-1, Math.min(1, dot)));
    };

    // --- Обчислення нормалей з виправленням напрямку ---
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];

        const p0 = [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]];
        const p1 = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
        const p2 = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];

        let e1 = m4.subtractVectors(p1, p0);
        let e2 = m4.subtractVectors(p2, p0);
        let facetNormal = m4.normalize(m4.cross(e1, e2));

        // Автоматичне виправлення напрямку нормалі
        const pCenter = [(p0[0]+p1[0]+p2[0])/3, (p0[1]+p1[1]+p2[1])/3, (p0[2]+p1[2]+p2[2])/3];
        const dir = m4.subtractVectors(pCenter, [0,0,0]);
        if (m4.dot(facetNormal, dir) < 0) {
            facetNormal = m4.scaleVector(facetNormal, -1);
        }

        const e3 = m4.subtractVectors(p0, p1);
        const e4 = m4.subtractVectors(p2, p1);
        const e5 = m4.subtractVectors(p0, p2);
        const e6 = m4.subtractVectors(p1, p2);

        const angle0 = getAngle(e1, e2);
        const angle1 = getAngle(e3, e4);
        const angle2 = getAngle(e5, e6);

        tempNormals[i0] = m4.addVectors(tempNormals[i0], m4.scaleVector(facetNormal, angle0));
        tempNormals[i1] = m4.addVectors(tempNormals[i1], m4.scaleVector(facetNormal, angle1));
        tempNormals[i2] = m4.addVectors(tempNormals[i2], m4.scaleVector(facetNormal, angle2));
    }

    // --- Усереднення нормалей на однакових вершинах ---
    let vertexMap = new Map(); // "x_y_z" -> список нормалей
    for (let i = 0; i < numVertices; i++) {
        const key = vertices[i*3].toFixed(5) + "_" + vertices[i*3+1].toFixed(5) + "_" + vertices[i*3+2].toFixed(5);
        if (!vertexMap.has(key)) vertexMap.set(key, []);
        vertexMap.get(key).push(tempNormals[i]);
    }

    for (let i = 0; i < numVertices; i++) {
        const key = vertices[i*3].toFixed(5) + "_" + vertices[i*3+1].toFixed(5) + "_" + vertices[i*3+2].toFixed(5);
        let avg = [0,0,0];
        vertexMap.get(key).forEach(n => avg = m4.addVectors(avg, n));
        normals.push(...m4.normalize(avg));
    }

    return { 
        vertices, 
        indices, 
        wireIndices, 
        normals 
    };
}


function CreateSphereData(radius, latBands, longBands) {
    let vertices = [];
    let indices = [];
    let normals = [];

    for (let lat = 0; lat <= latBands; lat++) {
        let theta = lat * Math.PI / latBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let long = 0; long <= longBands; long++) {
            let phi = long * 2 * Math.PI / longBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            let x = cosPhi * sinTheta;
            let y = cosTheta;
            let z = sinPhi * sinTheta;

            let u = 1 - (long / longBands);
            let v = 1 - (lat / latBands);

            normals.push(x, y, z);
            
            vertices.push(radius * x, radius * y, radius * z);
        }
    }

    for (let lat = 0; lat < latBands; lat++) {
        for (let long = 0; long < longBands; long++) {
            let first = (lat * (longBands + 1)) + long;
            let second = first + longBands + 1;

            indices.push(first);
            indices.push(second);
            indices.push(first + 1);

            indices.push(second);
            indices.push(second + 1);
            indices.push(first + 1);
        }
    }

    return { 
        vertices: vertices, 
        indices: indices, 
        normals: normals,
        wireIndices: indices 
    };
}


function updateUSteps(value) {
    uSteps = parseInt(value);
    document.getElementById('uSliderValue').textContent = value;
    updateSurface();
}

function updateVSteps(value) {
    vSteps = parseInt(value);
    document.getElementById('vSliderValue').textContent = value;
    updateSurface();
}

function setRenderMode(value) {
    renderMode = value;
    draw();
}

function updateSurface() {
    let data = CreateSurfaceData(); 
    surface.BufferData(data.vertices, data.indices, data.wireIndices, data.normals);
    
}


function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "a_position");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "a_normal");

    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "u_projectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "u_modelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "u_normalMatrix");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "u_lightPosition");
    shProgram.iWireframeColor = gl.getUniformLocation(prog, "u_wireframeColor");
    shProgram.iRenderMode = gl.getUniformLocation(prog, "u_renderMode"); 

    surface = new Model('Surface');
    let surfaceData = CreateSurfaceData();
    surface.BufferData(surfaceData.vertices, surfaceData.indices, surfaceData.wireIndices, surfaceData.normals);
    

    lightSphere = new Model('LightSphere');
    
    let sphereData = CreateSphereData(0.25, 20, 20); 
    lightSphere.BufferData(sphereData.vertices, sphereData.indices, sphereData.wireIndices, sphereData.normals);
    
}

function resizeCanvasToDisplaySize(canvas) {
    const size = Math.min(canvas.clientWidth, canvas.clientHeight);
    const displaySize = size * window.devicePixelRatio;

    if (canvas.width !== displaySize || canvas.height !== displaySize) {
        canvas.width = displaySize;
        canvas.height = displaySize;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
}


function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Vertex shader error: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh,fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Fragment shader error: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog,fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


function init() {
    let canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
        alert("WebGL not supported");
        return;
    }

    initGL();


    spaceball = new TrackballRotator(canvas, () => {}, 0); 

    canvas.addEventListener("wheel", (event) => {
        zoom += event.deltaY * 0.02;
        if (zoom < 4) zoom = 4;
        if (zoom > 80) zoom = 80;
        event.preventDefault();
    });
    
    window.addEventListener('resize', () => {});

    requestAnimationFrame(draw);
}
