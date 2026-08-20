function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202020);
    
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
    camera.position.set(8, 7, 10);
    camera.lookAt(cameraTarget);
    
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.shadowMap.enabled = true;
    
    if (THREE.PCFSoftShadowMap !== undefined) {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    viewport.appendChild(renderer.domElement);
    
    controls = new THREE.EditorControls(camera, renderer.domElement);
    controls.enabled = true;
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    createLighting();
    createGrid();
    createGround();
    createTransformControls();
    
    renderer.domElement.addEventListener("pointerdown", onPointerDown, false);
    renderer.domElement.addEventListener("pointermove", onPointerMove, false);
    renderer.domElement.addEventListener("pointerup", onPointerUp, false);
    renderer.domElement.addEventListener("pointercancel", onPointerUp, false);
    
    window.addEventListener("resize", onResize, false);
    document.addEventListener("keydown", onKeyDown, false);
    document.addEventListener("keyup", onKeyUp, false);
    
    setupExportMenu();
    setupMobileCamera();
    setupInspectorTransformEvents();
    updateObjectsList();
    onResize();
    loadStartupScene();
    animate();
}

function number(value) {
    return parseFloat(Number(value).toFixed(6));
}

fileInput.addEventListener("change", function() {
    if (!fileInput.files.length) {
        return;
    }

    var file = fileInput.files[0];
    var name = file.name.toLowerCase();
    var reader = new FileReader();

    reader.onload = function(event) {
        try {
            var result = event.target.result;

            if (name.endsWith(".hrmp.json")) {
                var data = JSON.parse(result);
                var before = serializeScene();
                importHRMP(data);
                undoStack.push(before);
                redoStack.length = 0;
                saveLocal();
                statusElement.textContent = "HRMP imported";
                return;
            }

            if (name.endsWith(".rbp")) {
                var before = serializeScene();
                importRBPFile(result);
                undoStack.push(before);
                redoStack.length = 0;
                saveLocal();
                statusElement.textContent = "RBP imported";
                return;
            }

            if (name.endsWith(".obj")) {
                importOBJText(result);
                return;
            }

            if (name.endsWith(".stl")) {
                importSTLBuffer(result);
                return;
            }

            if (name.endsWith(".json")) {
                var data = JSON.parse(result);

                if (data && data.format === "PLATFORMER_EDITOR") {
                    var before = serializeScene();

                    if (loadSerializedScene(data, false, false)) {
                        undoStack.push(before);
                        redoStack.length = 0;
                        saveLocal();
                        statusElement.textContent = "Scene imported";
                    }

                    return;
                }

                if (data && data.metadata && data.object) {
                    importObjectJSON(data);
                    return;
                }

                if (data && (data.type === "BufferGeometry" || data.type === "Geometry" || data.data)) {
                    importGeometryJSON(data);
                    return;
                }

                if (data && data.metadata && data.geometries) {
                    importObjectJSON(data);
                    return;
                }

                throw new Error("Unsupported JSON export.");
            }

            throw new Error("Unsupported file type.");
        } catch (error) {
            alert("Could not import \"" + file.name + "\":\n" + error.message);
            console.error("Import error:", error);
        }
    };

    if (name.endsWith(".rbp") || name.endsWith(".stl")) {
        reader.readAsArrayBuffer(file);
    } else if (name.endsWith(".json") || name.endsWith(".hrmp.json") || name.endsWith(".obj")) {
        reader.readAsText(file);
    } else {
        alert("Unsupported file type.");
    }
}, false);

init();
