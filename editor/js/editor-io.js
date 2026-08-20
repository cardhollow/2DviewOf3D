function isBuiltinGeometryType(type) {
    return (
        type === "box" ||
        type === "sphere" ||
        type === "cylinder" ||
        type === "plane" ||
        type === "cone" ||
        type === "torus"
    );
}function serializeGeometry(object) {
    var geometry = object && object.geometry;

    if (!geometry) {
        return null;
    }

    if (
        geometry.vertices &&
        geometry.faces &&
        geometry.vertices.length
    ) {
        var vertices = [];
        var faces = [];

        for (var i = 0; i < geometry.vertices.length; i++) {
            var vertex = geometry.vertices[i];

            vertices.push([
                vertex.x,
                vertex.y,
                vertex.z
            ]);
        }

        for (var f = 0; f < geometry.faces.length; f++) {
            var face = geometry.faces[f];

            faces.push({
                a: face.a,
                b: face.b,
                c: face.c,
                materialIndex: face.materialIndex || 0
            });
        }

        return {
            vertices: vertices,
            faces: faces
        };
    }

    // BufferGeometry fallback for imported/custom meshes.
    if (
        geometry.attributes &&
        geometry.attributes.position
    ) {
        var position =
            geometry.attributes.position;

        var bufferVertices = [];

        for (var v = 0; v < position.count; v++) {
            bufferVertices.push([
                position.getX(v),
                position.getY(v),
                position.getZ(v)
            ]);
        }

        var bufferFaces = [];

        if (geometry.index) {
            var index = geometry.index;

            for (var n = 0; n + 2 < index.count; n += 3) {
                bufferFaces.push({
                    a: index.getX(n),
                    b: index.getX(n + 1),
                    c: index.getX(n + 2),
                    materialIndex: 0
                });
            }
        } else {
            for (
                var unindexed = 0;
                unindexed + 2 < position.count;
                unindexed += 3
            ) {
                bufferFaces.push({
                    a: unindexed,
                    b: unindexed + 1,
                    c: unindexed + 2,
                    materialIndex: 0
                });
            }
        }

        return {
            vertices: bufferVertices,
            faces: bufferFaces
        };
    }

    return null;
}function restoreGeometry(object, geometryData) {
    if (
        !object ||
        !geometryData ||
        !Array.isArray(geometryData.vertices) ||
        !Array.isArray(geometryData.faces)
    ) {
        return false;
    }

    var geometry = new THREE.Geometry();

    for (var i = 0; i < geometryData.vertices.length; i++) {
        var vertex = geometryData.vertices[i];

        geometry.vertices.push(
            new THREE.Vector3(
                Number(vertex[0]) || 0,
                Number(vertex[1]) || 0,
                Number(vertex[2]) || 0
            )
        );
    }

    for (var f = 0; f < geometryData.faces.length; f++) {
        var face = geometryData.faces[f];

        geometry.faces.push(
            new THREE.Face3(
                face.a,
                face.b,
                face.c
            )
        );

        geometry.faces[geometry.faces.length - 1].materialIndex =
            face.materialIndex || 0;
    }

    geometry.computeFaceNormals();
    if (geometry.computeBoundingSphere) geometry.computeBoundingSphere();
    if (geometry.computeBoundingBox) geometry.computeBoundingBox();

    if (object.geometry) object.geometry.dispose();
    object.geometry = geometry;

    return true;
}function serializeObject(object) {
    var type = object.userData.type || "box";

    var result = {
        name: object.name,
        type: type,
        tags: (object.userData.tags || []).slice(),

        position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z
        },

        rotation: {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z
        },

        scale: {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z
        },

        color:
            object.material && object.material.color
                ? object.material.color.getHex()
                : 0xffffff,

        visible: object.visible
    };

    if (!isBuiltinGeometryType(type)) {
        var geometryData = serializeGeometry(object);

        if (geometryData) {
            result.geometry = geometryData;
        }
    }

    return result;
}function serializeScene() {
    var data = {
        format: "PLATFORMER_EDITOR",
        version: 1,
        objectCounter: objectCounter,
        objects: []
    };

    var objects = getEditorObjects();

    for (var i = 0; i < objects.length; i++) {
        data.objects.push(serializeObject(objects[i]));
    }

    return data;
}function recordModification(beforeState) {
    if (isRestoringHistory) {
        return;
    }

    var before = beforeState || serializeScene();
    var current = serializeScene();

    if (JSON.stringify(before) === JSON.stringify(current)) {
        saveLocal();
        return;
    }

    undoStack.push(before);
    redoStack.length = 0;
    saveLocal();
}function clearEditorObjects() {
    var objects = getEditorObjects();

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];

        scene.remove(object);

        if (object.geometry) {
            object.geometry.dispose();
        }

        if (object.material) {
            object.material.dispose();
        }
    }

    selected = null;
    selectedObjects = [];
    selectionAnchor = null;
    transformControls.detach();
}function loadSerializedScene(data, saveAfter, clearHistory) {
    if (!data || !Array.isArray(data.objects)) {
        alert("Invalid platformer scene.");
        return false;
    }

    isRestoringHistory = true;
    clearEditorObjects();
    objectCounter = data.objectCounter || 0;

    for (var i = 0; i < data.objects.length; i++) {
        var item = data.objects[i];
        var object = addObject(item.type || "box", null, false);

        object.name = item.name || "obj_" + i;
        object.userData.tags =
            Array.isArray(item.tags) ? item.tags.slice() : [];

        if (item.geometry) {
            restoreGeometry(object, item.geometry);
        }

        if (item.position) {
            object.position.set(
                item.position.x || 0,
                item.position.y || 0,
                item.position.z || 0
            );
        }

        if (item.rotation) {
            object.rotation.set(
                item.rotation.x || 0,
                item.rotation.y || 0,
                item.rotation.z || 0
            );
        }

        if (item.scale) {
            object.scale.set(
                item.scale.x === undefined ? 1 : item.scale.x,
                item.scale.y === undefined ? 1 : item.scale.y,
                item.scale.z === undefined ? 1 : item.scale.z
            );
        }

        if (item.color !== undefined) {
            object.material.color.setHex(item.color);
        }

        object.visible = item.visible !== false;

        object.updateMatrix();
        object.updateMatrixWorld(true);
    }

    isRestoringHistory = false;
    clearSelection();
    updateObjectsList();

    if (clearHistory) {
        undoStack.length = 0;
        redoStack.length = 0;
    }

    if (saveAfter) saveLocal();

    return true;
}function undo() {
    if (inspectorTransformHistoryState) {
        commitInspectorTransformHistory();
    }

    if (!undoStack.length) {
        statusElement.textContent = "Nothing to undo";
        return;
    }

    var current = serializeScene();
    var previous = undoStack.pop();

    redoStack.push(current);
    loadSerializedScene(previous, true, false);

    statusElement.textContent = "Undo";
}function redo() {
    if (inspectorTransformHistoryState) {
        commitInspectorTransformHistory();
    }

    if (!redoStack.length) {
        statusElement.textContent = "Nothing to redo";
        return;
    }

    var current = serializeScene();
    var next = redoStack.pop();

    undoStack.push(current);
    loadSerializedScene(next, true, false);

    statusElement.textContent = "Redo";
}function openEditorDatabase() {
    if (!window.indexedDB) {
        return Promise.reject(
            new Error("IndexedDB is not supported in this browser.")
        );
    }

    if (idbDatabasePromise) {
        return idbDatabasePromise;
    }

    idbDatabasePromise = new Promise(function(resolve, reject) {
        var request = indexedDB.open(
            IDB_NAME,
            IDB_VERSION
        );

        request.onupgradeneeded = function(event) {
            var db = event.target.result;

            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };

        request.onsuccess = function(event) {
            var db = event.target.result;

            db.onversionchange = function() {
                db.close();
            };

            resolve(db);
        };

        request.onerror = function() {
            reject(
                request.error ||
                new Error("Could not open the editor IndexedDB database.")
            );
        };

        request.onblocked = function() {
            reject(
                new Error("The editor IndexedDB database is blocked by another connection.")
            );
        };
    });

    return idbDatabasePromise;
}function buildCurrentRBPBinary() {
    var data = getRBPData();

    data = optimizeRBP(data);

    var rawBinary = writeRBPBinary(data);
    var compressed = compressRBPRepeatedly(rawBinary);

    return buildRBPFile(
        rawBinary,
        compressed.bytes,
        compressed.methods
    );
}function saveScene() {
    saveLocal();
    statusElement.textContent = "Saved";
}function saveLocal() {
    try {
        var finalBinary = buildCurrentRBPBinary();
        var storedBuffer = finalBinary.buffer.slice(
            finalBinary.byteOffset,
            finalBinary.byteOffset + finalBinary.byteLength
        );

        openEditorDatabase()
            .then(function(db) {
                return new Promise(function(resolve, reject) {
                    var transaction = db.transaction(
                        IDB_STORE,
                        "readwrite"
                    );
                    var store = transaction.objectStore(IDB_STORE);

                    store.put(
                        {
                            name: "scene.rbp",
                            type: "application/octet-stream",
                            data: storedBuffer,
                            savedAt: Date.now()
                        },
                        IDB_RBP_KEY
                    );

                    transaction.oncomplete = function() {
                        resolve();
                    };

                    transaction.onerror = function() {
                        reject(
                            transaction.error ||
                            new Error("IndexedDB save failed.")
                        );
                    };

                    transaction.onabort = function() {
                        reject(
                            transaction.error ||
                            new Error("IndexedDB save was aborted.")
                        );
                    };
                });
            })
            .catch(function(error) {
                console.warn("Autosave failed", error);
            });
    } catch(error) {
        console.warn("Autosave failed", error);
    }
}function readSavedRBP() {
    return openEditorDatabase().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(
                IDB_STORE,
                "readonly"
            );
            var store = transaction.objectStore(IDB_STORE);
            var request = store.get(IDB_RBP_KEY);

            request.onsuccess = function() {
                resolve(request.result || null);
            };

            request.onerror = function() {
                reject(
                    request.error ||
                    new Error("Could not read the saved RBP file.")
                );
            };
        });
    });
}function importSavedRBP(record) {
    if (!record || !record.data) {
        throw new Error("No saved RBP file found.");
    }

    importRBPFile(record.data);
}async function loadScene() {
    try {
        var record = await readSavedRBP();

        if (!record) {
            alert("No saved scene found.");
            return;
        }

        importSavedRBP(record);
        statusElement.textContent = "Loaded";
    } catch(error) {
        alert("Could not load scene:\n" + error.message);
        console.error("Load error:", error);
    }
}async function loadStartupScene() {
    try {
        var record = await readSavedRBP();

        if (!record) {
            return;
        }

        isRestoringHistory = true;
        clearEditorObjects();
        importSavedRBP(record);
        isRestoringHistory = false;

        undoStack.length = 0;
        redoStack.length = 0;
        clearSelection();
        updateObjectsList();
        statusElement.textContent = "Restored";
    } catch(error) {
        isRestoringHistory = false;
        console.warn("Autosave load failed", error);
    }
}function newScene() {
    if (!confirm("Any unsaved data will be lost. Are you sure?")) {
        return;
    }

    var before = serializeScene();

    clearEditorObjects();
    objectCounter = 0;
    undoStack.push(before);
    redoStack.length = 0;

    updateObjectsList();
    updateInspector();
    saveLocal();

    statusElement.textContent = "New Scene";
}function createExportGroup() {
    var group = new THREE.Group();
    group.name = "PlatformerScene";

    var objects = getEditorObjects();

    for (var i = 0; i < objects.length; i++) {
        var clone = objects[i].clone();

        clone.material = objects[i].material.clone();
        clone.geometry = objects[i].geometry.clone();

        group.add(clone);
    }

    return group;
}function parseNumber(key, value) {
    return typeof value === "number"
        ? parseFloat(value.toFixed(6))
        : value;
}function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function() {
        URL.revokeObjectURL(url);
    }, 100);
}function saveString(text, filename) {
    saveBlob(
        new Blob([text], {type: "text/plain"}),
        filename
    );
}