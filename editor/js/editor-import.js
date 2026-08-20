function importScene() {
    fileInput.value = "";
    fileInput.click();
}function clearImportedScene() {
    var objects = getEditorObjects();

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];

        scene.remove(object);

        if (object.geometry) {
            object.geometry.dispose();
        }

        if (object.material) {
            if (Array.isArray(object.material)) {
                for (var m = 0; m < object.material.length; m++) {
                    object.material[m].dispose();
                }
            } else {
                object.material.dispose();
            }
        }
    }

    selected = null;
    transformControls.detach();
}function addImportedObject(object, name) {
    if (!object) {
        return null;
    }

    if (object.isMesh) {
        object.userData = object.userData || {};
        object.userData.editorObject = true;
        object.userData.type = object.userData.type || "imported";

        if (!object.name) {
            object.name = name || "object" + (++objectCounter);
        }

        objectCounter++;
        scene.add(object);

        return object;
    }

    return null;
}function collectImportedMeshes(object, result) {
    if (!object) {
        return;
    }

    if (object.isMesh) {
        result.push(object);
        return;
    }

    if (object.children) {
        for (var i = 0; i < object.children.length; i++) {
            collectImportedMeshes(
                object.children[i],
                result
            );
        }
    }
}function finishImport(objects, label) {
    if (!objects || !objects.length) {
        throw new Error("The imported file contained no renderable objects.");
    }

    var before = serializeScene();

    clearImportedScene();

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];

        object.userData = object.userData || {};
        object.userData.editorObject = true;

        if (!object.userData.type) {
            object.userData.type = "imported";
        }

        if (!object.name) {
            object.name =
                "obj_" +
                (++objectCounter);
        }

        scene.add(object);
    }

    updateObjectsList();
    clearSelection();

    undoStack.push(before);
    redoStack.length = 0;
    saveLocal();

    statusElement.textContent =
        label + " imported";
}function importSceneJSON(data) {
    if (
        data &&
        data.format === "PLATFORMER_EDITOR" &&
        Array.isArray(data.objects)
    ) {
        if (
            loadSerializedScene(
                data,
                false,
                false
            )
        ) {
            return true;
        }

        return false;
    }

    throw new Error(
        "This JSON file is not a supported scene export."
    );
}function importObjectJSON(data) {
    if (
        typeof THREE.ObjectLoader !==
        "function"
    ) {
        throw new Error(
            "ObjectLoader is not available in this Three.js build."
        );
    }

    var loader =
        new THREE.ObjectLoader();

    var object =
        loader.parse(data);

    var meshes = [];

    collectImportedMeshes(
        object,
        meshes
    );

    finishImport(
        meshes,
        "Object"
    );

    return true;
}function importGeometryJSON(data) {
    var geometry = null;

    if (
        typeof THREE.JSONLoader ===
        "function"
    ) {
        var loader =
            new THREE.JSONLoader();

        var parsed =
            loader.parse(
                data.data || data
            );

        if (parsed) {
            geometry = parsed.geometry;
        }
    }

    if (
        !geometry &&
        typeof THREE.BufferGeometryLoader ===
        "function"
    ) {
        var bufferLoader =
            new THREE.BufferGeometryLoader();

        geometry =
            bufferLoader.parse(
                data.data || data
            );
    }

    if (!geometry) {
        throw new Error(
            "Could not read geometry.json with this Three.js build."
        );
    }

    var material =
        createMaterial(0xffffff);

    var mesh =
        new THREE.Mesh(
            geometry,
            material
        );

    mesh.name =
        "obj_Geometry_" +
        (++objectCounter);

    mesh.userData.editorObject = true;
    mesh.userData.type = "imported";

    finishImport(
        [mesh],
        "Geometry"
    );

    return true;
}function importHRMP(data) {
    if (
        !data ||
        data.format !== "HRMP" ||
        !Array.isArray(data.vertices) ||
        !Array.isArray(data.faces)
    ) {
        throw new Error(
            "Invalid HRMP file."
        );
    }

    var objects = [];
    var colorGroups = {};
    var edgeGroups = {};

    function getFaceColor(face) {
        return String(
            face.surfaceColor ||
            face.cols ||
            "FFFFFF"
        ).toUpperCase();
    }

    function getEdgeColor(edge) {
        return String(
            edge.edgeColor ||
            edge.cole ||
            "FFFFFF"
        ).toUpperCase();
    }

    for (
        var i = 0;
        i < data.faces.length;
        i++
    ) {
        var face =
            data.faces[i];

        if (
            !face.vertices ||
            face.vertices.length < 3
        ) {
            continue;
        }

        var color =
            getFaceColor(face);

        if (!colorGroups[color]) {
            colorGroups[color] = [];
        }

        colorGroups[color].push(face);
    }

    for (var color in colorGroups) {
        if (!colorGroups.hasOwnProperty(color)) {
            continue;
        }

        var geometry =
            new THREE.Geometry();

        var vertices =
            data.vertices;

        for (
            var v = 0;
            v < vertices.length;
            v++
        ) {
            geometry.vertices.push(
                new THREE.Vector3(
                    Number(vertices[v][0]) || 0,
                    Number(vertices[v][1]) || 0,
                    Number(vertices[v][2]) || 0
                )
            );
        }

        var faces =
            colorGroups[color];

        for (
            var f = 0;
            f < faces.length;
            f++
        ) {
            var indices =
                faces[f].vertices;

            for (
                var n = 1;
                n < indices.length - 1;
                n++
            ) {
                geometry.faces.push(
                    new THREE.Face3(
                        indices[0],
                        indices[n],
                        indices[n + 1]
                    )
                );
            }
        }

        geometry.computeFaceNormals();

        var material =
            createMaterial(
                "#" + color
            );

        var mesh =
            new THREE.Mesh(
                geometry,
                material
            );

        mesh.name =
            "HRMP_Surface_" +
            (++objectCounter);

        mesh.userData.editorObject =
            true;

        mesh.userData.type =
            "hrmp_surface";

        objects.push(mesh);
    }

    for (
        var i = 0;
        i < data.edges.length;
        i++
    ) {
        var edge =
            data.edges[i];

        if (
            !edge.vertices ||
            edge.vertices.length < 2
        ) {
            continue;
        }

        var color =
            getEdgeColor(edge);

        if (!edgeGroups[color]) {
            edgeGroups[color] = [];
        }

        edgeGroups[color].push(edge);
    }

    for (var edgeColor in edgeGroups) {
        if (
            !edgeGroups.hasOwnProperty(
                edgeColor
            )
        ) {
            continue;
        }

        var lineGeometry =
            new THREE.Geometry();

        var edgeList =
            edgeGroups[edgeColor];

        for (
            var e = 0;
            e < edgeList.length;
            e++
        ) {
            var pair =
                edgeList[e].vertices;

            var a =
                data.vertices[pair[0]];

            var b =
                data.vertices[pair[1]];

            if (!a || !b) {
                continue;
            }

            lineGeometry.vertices.push(
                new THREE.Vector3(
                    Number(a[0]) || 0,
                    Number(a[1]) || 0,
                    Number(a[2]) || 0
                )
            );

            lineGeometry.vertices.push(
                new THREE.Vector3(
                    Number(b[0]) || 0,
                    Number(b[1]) || 0,
                    Number(b[2]) || 0
                )
            );
        }

        var lineMaterial =
            new THREE.LineBasicMaterial({
                color: "#" + edgeColor
            });

        var lines;

        if (
            THREE.LineSegments
        ) {
            lines =
                new THREE.LineSegments(
                    lineGeometry,
                    lineMaterial
                );
        } else {
            lines =
                new THREE.Line(
                    lineGeometry,
                    lineMaterial
                );
        }

        lines.name =
            "HRMP_Edges_" +
            (++objectCounter);

        lines.userData =
            lines.userData || {};

        lines.userData.editorObject =
            true;

        lines.userData.type =
            "hrmp_edge";

        objects.push(lines);
    }

    if (!objects.length) {
        throw new Error(
            "HRMP contained no renderable faces or edges."
        );
    }

    finishImport(
        objects,
        "HRMP"
    );

    return true;
}function createRBPGeometry(definitionObject) {
    var geometry =
        new THREE.Geometry();

    if (
        !definitionObject ||
        !Array.isArray(
            definitionObject.vertices
        )
    ) {
        return geometry;
    }

    for (
        var i = 0;
        i < definitionObject.vertices.length;
        i++
    ) {
        var vertex =
            definitionObject.vertices[i];

        geometry.vertices.push(
            new THREE.Vector3(
                Number(vertex[0]) || 0,
                Number(vertex[1]) || 0,
                Number(vertex[2]) || 0
            )
        );
    }

    if (
        Array.isArray(
            definitionObject.faces
        )
    ) {
        for (
            var f = 0;
            f < definitionObject.faces.length;
            f++
        ) {
            var face =
                definitionObject.faces[f];

            if (
                !face.vertices ||
                face.vertices.length < 3
            ) {
                continue;
            }

            for (
                var n = 1;
                n < face.vertices.length - 1;
                n++
            ) {
                geometry.faces.push(
                    new THREE.Face3(
                        face.vertices[0],
                        face.vertices[n],
                        face.vertices[n + 1]
                    )
                );
            }
        }
    }

    geometry.computeFaceNormals();

    return geometry;
}function importRBP(data) {
    if (
        !data ||
        !(data instanceof Uint8Array)
    ) {
        throw new Error(
            "Invalid RBP binary."
        );
    }

    var offset = 0;

    function readUint8() {
        if (offset + 1 > data.length) {
            throw new Error(
                "Unexpected end of RBP file."
            );
        }

        return data[offset++];
    }

    function readUint16() {
        if (offset + 2 > data.length) {
            throw new Error(
                "Unexpected end of RBP file."
            );
        }

        var value =
            data[offset] |
            (data[offset + 1] << 8);

        offset += 2;

        return value >>> 0;
    }

    function readUint32() {
        if (offset + 4 > data.length) {
            throw new Error(
                "Unexpected end of RBP file."
            );
        }

        var value =
            data[offset] |
            (data[offset + 1] << 8) |
            (data[offset + 2] << 16) |
            (data[offset + 3] << 24);

        offset += 4;

        return value >>> 0;
    }

    function readFloat32() {
        if (offset + 4 > data.length) {
            throw new Error(
                "Unexpected end of RBP file."
            );
        }

        var buffer =
            new ArrayBuffer(4);

        var bytes =
            new Uint8Array(buffer);

        bytes[0] = data[offset++];
        bytes[1] = data[offset++];
        bytes[2] = data[offset++];
        bytes[3] = data[offset++];

        return new DataView(buffer)
            .getFloat32(0, true);
    }

    function readVector3() {
        return [
            readFloat32(),
            readFloat32(),
            readFloat32()
        ];
    }

    function readString() {
        var length = readUint16();

        if (offset + length > data.length) {
            throw new Error(
                "Unexpected end of RBP string."
            );
        }

        var bytes = data.slice(offset, offset + length);
        offset += length;

        return new TextDecoder().decode(bytes);
    }

    if (
        readUint8() !== 0x52 ||
        readUint8() !== 0x42 ||
        readUint8() !== 0x50
    ) {
        throw new Error(
            "Not an RBP file."
        );
    }

    var versionByte =
        readUint8();

    if (
        versionByte !== 0x01 &&
        versionByte !== 0x02
    ) {
        throw new Error(
            "Unsupported RBP version."
        );
    }

    if (versionByte === 0x02) {
        return importCompressedRBP(
            data
        );
    }

    readUint16();

    var featureFlags =
        readUint16();

    var hasTags =
        !!(featureFlags & 1);

    var definitionCount =
        readUint32();

    var colorCount =
        readUint32();

    var attributeCount =
        readUint32();

    var transformCount =
        readUint32();

    var tagCount = hasTags
        ? readUint32()
        : 0;

    var programCount =
        readUint32();

    var colors = [];

    for (
        var c = 0;
        c < colorCount;
        c++
    ) {
        var r = readUint8();
        var g = readUint8();
        var b = readUint8();

        colors.push(
            (
                (r << 16) |
                (g << 8) |
                b
            ).toString(16)
                .padStart(6, "0")
                .toUpperCase()
        );
    }

    var attributes = [];

    for (
        var a = 0;
        a < attributeCount;
        a++
    ) {
        var attributeFlags =
            readUint8();

        var colorId =
            readUint16();

        attributes.push({
            surface:
                !!(attributeFlags & 1),

            edge:
                !!(attributeFlags & 2),

            color:
                colorId
        });
    }

    var transforms = [];

    for (
        var t = 0;
        t < transformCount;
        t++
    ) {
        transforms.push({
            rotation:
                readVector3(),

            scale:
                readVector3()
        });
    }

    var tags = [];

    for (
        var g = 0;
        g < tagCount;
        g++
    ) {
        var tagId = readUint32();
        var tagValueCount = readUint16();
        var values = [];

        for (var tv = 0; tv < tagValueCount; tv++) {
            values.push(readString());
        }

        tags.push({
            id: tagId,
            values: values
        });
    }

    var definitions = [];

    for (
        var d = 0;
        d < definitionCount;
        d++
    ) {
        var op =
            readUint8();

        if (op !== 1) {
            throw new Error(
                "Invalid RBP definition opcode."
            );
        }

        var definitionId =
            readUint32();

        var objectCount =
            readUint32();

        var definition = {
            id: definitionId,
            objects: []
        };

        for (
            var o = 0;
            o < objectCount;
            o++
        ) {
            var objectOp =
                readUint8();

            if (objectOp !== 2) {
                throw new Error(
                    "Invalid RBP object opcode."
                );
            }

            var vertexCount =
                readUint32();

            var vertices = [];

            for (
                var v = 0;
                v < vertexCount;
                v++
            ) {
                readUint32();

                vertices.push(
                    readVector3()
                );
            }

            var faceCount =
                readUint32();

            var faces = [];

            for (
                var f = 0;
                f < faceCount;
                f++
            ) {
                var faceOp =
                    readUint8();

                if (faceOp !== 4) {
                    throw new Error(
                        "Invalid RBP face opcode."
                    );
                }

                var faceVertexCount =
                    readUint32();

                var faceVertices = [];

                for (
                    var fv = 0;
                    fv < faceVertexCount;
                    fv++
                ) {
                    faceVertices.push(
                        readUint32()
                    );
                }

                var faceFlags =
                    readUint8();

                faces.push({
                    vertices:
                        faceVertices,

                    surface:
                        !!(faceFlags & 1),

                    edge:
                        !!(faceFlags & 2)
                });
            }

            var edgeCount =
                readUint32();

            var edges = [];

            for (
                var e = 0;
                e < edgeCount;
                e++
            ) {
                var edgeOp =
                    readUint8();

                if (edgeOp !== 5) {
                    throw new Error(
                        "Invalid RBP edge opcode."
                    );
                }

                edges.push({
                    vertices: [
                        readUint32(),
                        readUint32()
                    ],

                    edge:
                        !!readUint8(),

                    closed:
                        !!readUint8()
                });
            }

            var defaultAttribute =
                readUint32();

            var referenceCount =
                readUint32();

            var references = [];

            for (
                var r = 0;
                r < referenceCount;
                r++
            ) {
                var referenceOp =
                    readUint8();

                if (referenceOp !== 6) {
                    throw new Error(
                        "Invalid RBP reference opcode."
                    );
                }

                references.push({
                    definition:
                        readUint32()
                });
            }

            definition.objects.push({
                vertices: vertices,
                faces: faces,
                edges: edges,
                defaultAttribute:
                    defaultAttribute,
                references: references
            });
        }

        var end =
            readUint8();

        if (end !== 255) {
            throw new Error(
                "Invalid RBP definition terminator."
            );
        }

        definitions.push(
            definition
        );
    }

    var program = [];

    for (
        var p = 0;
        p < programCount;
        p++
    ) {
        var opcode =
            readUint8();

        if (opcode === 16) {
            program.push({
                op: "reference",

                target:
                    readUint32(),

                position:
                    readVector3(),

                transform:
                    readUint32(),

                attributes:
                    readUint32(),

                tags:
                    hasTags
                        ? readUint32()
                        : 0xffffffff
            });
        } else if (opcode === 17) {
            program.push({
                op: "repeat",

                target:
                    readUint32(),

                start:
                    readVector3(),

                interval:
                    readVector3(),

                count:
                    readUint32(),

                transform:
                    readUint32(),

                attributes:
                    readUint32(),

                tags:
                    hasTags
                        ? readUint32()
                        : 0xffffffff
            });
        } else {
            throw new Error(
                "Invalid RBP program opcode."
            );
        }
    }

    var definitionMap = {};

    for (
        var i = 0;
        i < definitions.length;
        i++
    ) {
        definitionMap[
            definitions[i].id
        ] = definitions[i];
    }

    function getAttribute(
        attributeId,
        fallbackId
    ) {
        var id =
            attributeId === 0xffffffff
                ? fallbackId
                : attributeId;

        return (
            attributes[id] || {
                surface: true,
                edge: false,
                color: 0
            }
        );
    }

    function getTags(
        tagId
    ) {
        if (tagId === 0xffffffff || tagId === null || tagId === undefined) {
            return [];
        }

        for (var ti = 0; ti < tags.length; ti++) {
            if (tags[ti].id === tagId) {
                return tags[ti].values.slice();
            }
        }

        return [];
    }

    function getMaterialColor(
        attribute
    ) {
        var hex =
            colors[
                attribute.color
            ] || "FFFFFF";

        return "#" + hex;
    }

    function bakeWorldTransform(
        object,
        parent
    ) {
        parent.updateMatrixWorld(true);
        object.updateMatrix();

        var matrix =
            parent.matrixWorld.clone();

        matrix.multiply(
            object.matrix
        );

        matrix.decompose(
            object.position,
            object.quaternion,
            object.scale
        );

        object.rotation.setFromQuaternion(
            object.quaternion
        );

        object.updateMatrix();
    }

    function appendDefinition(
        definitionId,
        parent,
        stack
    ) {
        if (stack[definitionId]) {
            return;
        }

        var definition =
            definitionMap[
                definitionId
            ];

        if (!definition) {
            return;
        }

        stack[definitionId] = true;

        for (
            var i = 0;
            i < definition.objects.length;
            i++
        ) {
            var object =
                definition.objects[i];

            var attribute =
                getAttribute(
                    0xffffffff,
                    object.defaultAttribute
                );

            if (
                object.vertices &&
                object.faces &&
                object.faces.length
            ) {
                var geometry =
                    createRBPGeometry(
                        object
                    );

                var material =
                    createMaterial(
                        getMaterialColor(
                            attribute
                        )
                    );

                var mesh =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                mesh.userData =
                    mesh.userData || {};

                mesh.userData.editorObject =
                    true;

                mesh.userData.type =
                    "rbp";

                parent.add(mesh);
            }

            if (
                object.references
            ) {
                for (
                    var r = 0;
                    r < object.references.length;
                    r++
                ) {
                    appendDefinition(
                        object.references[r]
                            .definition,

                        parent,

                        stack
                    );
                }
            }
        }

        delete stack[definitionId];
    }

    var importedObjects = [];

    for (
        var pi = 0;
        pi < program.length;
        pi++
    ) {
        var instruction =
            program[pi];

        var transform =
            transforms[
                instruction.transform
            ];

        var attributeId =
            instruction.attributes;

        var targetAttribute =
            getAttribute(
                attributeId,
                null
            );

        var targetTags =
            getTags(instruction.tags);

        if (
            instruction.op ===
            "reference"
        ) {
            var group =
                new THREE.Group();

            group.updateMatrixWorld(true);

            appendDefinition(
                instruction.target,
                group,
                {}
            );

            if (transform) {
                group.rotation.set(
                    transform.rotation[0],
                    transform.rotation[1],
                    transform.rotation[2]
                );

                group.scale.set(
                    transform.scale[0],
                    transform.scale[1],
                    transform.scale[2]
                );
            }

            group.position.set(
                instruction.position[0],
                instruction.position[1],
                instruction.position[2]
            );

            group.updateMatrixWorld(true);

            var meshes = [];

            collectImportedMeshes(
                group,
                meshes
            );

            for (
                var m = 0;
                m < meshes.length;
                m++
            ) {
                var mesh = meshes[m];

                bakeWorldTransform(
                    mesh,
                    group
                );

                if (
                    instruction.attributes !==
                    0xffffffff
                ) {
                    mesh.material.color.set(
                        getMaterialColor(
                            targetAttribute
                        )
                    );
                }

                mesh.userData.type =
                    "rbp";

                mesh.userData.tags =
                    targetTags.slice();

                importedObjects.push(
                    mesh
                );
            }
        }

        if (
            instruction.op ===
            "repeat"
        ) {
            for (
                var n = 0;
                n < instruction.count;
                n++
            ) {
                var repeatGroup =
                    new THREE.Group();

                appendDefinition(
                    instruction.target,
                    repeatGroup,
                    {}
                );

                if (transform) {
                    repeatGroup.rotation.set(
                        transform.rotation[0],
                        transform.rotation[1],
                        transform.rotation[2]
                    );

                    repeatGroup.scale.set(
                        transform.scale[0],
                        transform.scale[1],
                        transform.scale[2]
                    );
                }

                repeatGroup.position.set(
                    instruction.start[0] +
                    instruction.interval[0] * n,

                    instruction.start[1] +
                    instruction.interval[1] * n,

                    instruction.start[2] +
                    instruction.interval[2] * n
                );

                repeatGroup.updateMatrixWorld(
                    true
                );

                var repeatedMeshes = [];

                collectImportedMeshes(
                    repeatGroup,
                    repeatedMeshes
                );

                for (
                    var rm = 0;
                    rm < repeatedMeshes.length;
                    rm++
                ) {
                    var repeatedMesh =
                        repeatedMeshes[rm];

                    bakeWorldTransform(
                        repeatedMesh,
                        repeatGroup
                    );

                    if (
                        instruction.attributes !==
                        0xffffffff
                    ) {
                        repeatedMesh.material.color.set(
                            getMaterialColor(
                                targetAttribute
                            )
                        );
                    }

                    repeatedMesh.userData.type =
                        "rbp";

                    repeatedMesh.userData.tags =
                        targetTags.slice();

                    importedObjects.push(
                        repeatedMesh
                    );
                }
            }
        }
    }

    if (!importedObjects.length) {
        throw new Error(
            "RBP contained no renderable program instructions."
        );
    }

    finishImport(
        importedObjects,
        "RBP"
    );

    return true;
}function importCompressedRBP(data) {
    throw new Error(
        "Compressed RBP import requires the compression decoder for this RBP version."
    );
}function parseOBJ(text) {
    var geometry =
        new THREE.Geometry();

    var lines =
        text.split(/\r?\n/);

    var vertices = [];

    for (
        var i = 0;
        i < lines.length;
        i++
    ) {
        var line =
            lines[i].trim();

        if (!line) {
            continue;
        }

        if (
            line.substr(0, 2) ===
            "v "
        ) {
            var parts =
                line
                    .split(/\s+/)
                    .slice(1);

            vertices.push(
                new THREE.Vector3(
                    Number(parts[0]) || 0,
                    Number(parts[1]) || 0,
                    Number(parts[2]) || 0
                )
            );
        }

        if (
            line.substr(0, 2) ===
            "f "
        ) {
            var faceParts =
                line
                    .split(/\s+/)
                    .slice(1);

            var indices = [];

            for (
                var p = 0;
                p < faceParts.length;
                p++
            ) {
                var indexText =
                    faceParts[p]
                        .split("/")[0];

                var index =
                    parseInt(
                        indexText,
                        10
                    );

                if (isNaN(index)) {
                    continue;
                }

                if (index < 0) {
                    index =
                        vertices.length +
                        index;
                } else {
                    index =
                        index - 1;
                }

                indices.push(index);
            }

            for (
                var n = 1;
                n < indices.length - 1;
                n++
            ) {
                geometry.faces.push(
                    new THREE.Face3(
                        indices[0],
                        indices[n],
                        indices[n + 1]
                    )
                );
            }
        }
    }

    for (
        var v = 0;
        v < vertices.length;
        v++
    ) {
        geometry.vertices.push(
            vertices[v]
        );
    }

    geometry.computeFaceNormals();

    return geometry;
}function importOBJText(text) {
    var geometry =
        parseOBJ(text);

    if (!geometry.vertices.length) {
        throw new Error(
            "OBJ contained no vertices."
        );
    }

    var mesh =
        new THREE.Mesh(
            geometry,
            createMaterial(0xffffff)
        );

    mesh.name =
        "obj_OBJ_" +
        (++objectCounter);

    mesh.userData.editorObject = true;
    mesh.userData.type = "obj";

    finishImport(
        [mesh],
        "OBJ"
    );

    return true;
}function parseBinarySTL(buffer) {
    if (buffer.byteLength < 84) {
        return null;
    }

    var view =
        new DataView(buffer);

    var count =
        view.getUint32(
            80,
            true
        );

    var expected =
        84 +
        count * 50;

    if (
        expected !==
        buffer.byteLength
    ) {
        return null;
    }

    var geometry =
        new THREE.Geometry();

    var offset = 84;

    for (
        var i = 0;
        i < count;
        i++
    ) {
        offset += 12;

        var base =
            geometry.vertices.length;

        for (
            var v = 0;
            v < 3;
            v++
        ) {
            geometry.vertices.push(
                new THREE.Vector3(
                    view.getFloat32(
                        offset,
                        true
                    ),
                    view.getFloat32(
                        offset + 4,
                        true
                    ),
                    view.getFloat32(
                        offset + 8,
                        true
                    )
                )
            );

            offset += 12;
        }

        geometry.faces.push(
            new THREE.Face3(
                base,
                base + 1,
                base + 2
            )
        );

        offset += 2;
    }

    geometry.computeFaceNormals();

    return geometry;
}function parseASCIISTL(text) {
    var geometry =
        new THREE.Geometry();

    var lines =
        text.split(/\r?\n/);

    for (
        var i = 0;
        i < lines.length;
        i++
    ) {
        var line =
            lines[i].trim();

        if (
            line.substr(0, 6)
                .toLowerCase() !==
            "vertex"
        ) {
            continue;
        }

        var parts =
            line.split(/\s+/);

        geometry.vertices.push(
            new THREE.Vector3(
                Number(parts[1]) || 0,
                Number(parts[2]) || 0,
                Number(parts[3]) || 0
            )
        );

        if (
            geometry.vertices.length % 3 ===
            0
        ) {
            var base =
                geometry.vertices.length -
                3;

            geometry.faces.push(
                new THREE.Face3(
                    base,
                    base + 1,
                    base + 2
                )
            );
        }
    }

    geometry.computeFaceNormals();

    return geometry;
}function importSTLBuffer(buffer) {
    var geometry =
        parseBinarySTL(buffer);

    if (!geometry) {
        var text =
            new TextDecoder()
                .decode(buffer);

        geometry =
            parseASCIISTL(text);
    }

    if (
        !geometry ||
        !geometry.vertices.length
    ) {
        throw new Error(
            "STL contained no vertices."
        );
    }

    var mesh =
        new THREE.Mesh(
            geometry,
            createMaterial(0xffffff)
        );

    mesh.name =
        "obj_STL_" +
        (++objectCounter);

    mesh.userData.editorObject = true;
    mesh.userData.type = "stl";

    finishImport(
        [mesh],
        "STL"
    );

    return true;
}function decodeRBPCompression(
    data
) {
    var offset = 0;

    function readUint8() {
        return data[offset++];
    }

    function readUint16() {
        var value =
            data[offset] |
            (data[offset + 1] << 8);

        offset += 2;

        return value >>> 0;
    }

    function readUint32() {
        var value =
            data[offset] |
            (data[offset + 1] << 8) |
            (data[offset + 2] << 16) |
            (data[offset + 3] << 24);

        offset += 4;

        return value >>> 0;
    }

    if (
        readUint8() !== 0x52 ||
        readUint8() !== 0x42 ||
        readUint8() !== 0x50 ||
        readUint8() !== 0x32
    ) {
        return null;
    }

    readUint16();
    readUint16();

    var rawLength =
        readUint32();

    var compressedLength =
        readUint32();

    var methodCount =
        readUint16();

    var methodIds = [];

    for (
        var i = 0;
        i < methodCount;
        i++
    ) {
        methodIds.push(
            readUint8()
        );
    }

    var compressed =
        data.slice(
            offset,
            offset +
            compressedLength
        );

    var methods = [];

    var names = {
        1: "delta",
        2: "zigzag-varint",
        3: "varint",
        4: "rle",
        5: "lz77"
    };

    for (
        var m = 0;
        m < methodIds.length;
        m++
    ) {
        methods.push(
            names[
                methodIds[m]
            ]
        );
    }

    var current =
        new Uint8Array(
            compressed
        );

    function readVarInt(
        bytes,
        state
    ) {
        var result = 0;
        var shift = 0;

        while (
            state.index <
                bytes.length
        ) {
            var value =
                bytes[
                    state.index++
                ];

            result |=
                (value & 127) <<
                shift;

            if (
                !(value & 128)
            ) {
                return result >>> 0;
            }

            shift += 7;
        }

        throw new Error(
            "Invalid VarInt stream."
        );
    }

    function zigzagDecode(value) {
        return (
            (value >>> 1) ^
            -(value & 1)
        );
    }

    function decodeVarInt(
        bytes
    ) {
        var output = [];
        var state = {
            index: 0
        };

        while (
            state.index <
            bytes.length
        ) {
            output.push(
                readVarInt(
                    bytes,
                    state
                )
            );
        }

        return new Uint8Array(
            output
        );
    }

    function decodeZigzagVarintDelta(
        bytes
    ) {
        var output = [];
        var state = {
            index: 0
        };

        var previous = 0;

        while (
            state.index <
            bytes.length
        ) {
            var encoded =
                readVarInt(
                    bytes,
                    state
                );

            var delta =
                zigzagDecode(
                    encoded
                );

            var value =
                (
                    previous +
                    delta +
                    256
                ) & 255;

            output.push(value);

            previous = value;
        }

        return new Uint8Array(
            output
        );
    }

    function decodeDelta(
        bytes
    ) {
        if (!bytes.length) {
            return new Uint8Array(0);
        }

        var output =
            new Uint8Array(
                bytes.length
            );

        output[0] =
            bytes[0];

        for (
            var i = 1;
            i < bytes.length;
            i++
        ) {
            output[i] =
                (
                    output[i - 1] +
                    bytes[i]
                ) & 255;
        }

        return output;
    }

    function decodeRLE(
        bytes
    ) {
        var output = [];
        var index = 0;

        while (
            index < bytes.length
        ) {
            var control =
                bytes[index++];

            if (
                control & 0x80
            ) {
                var count =
                    (control & 0x7f) +
                    1;

                var value =
                    bytes[index++];

                for (
                    var i = 0;
                    i < count;
                    i++
                ) {
                    output.push(
                        value
                    );
                }
            } else {
                var length =
                    control + 1;

                for (
                    var i = 0;
                    i < length;
                    i++
                ) {
                    output.push(
                        bytes[index++]
                    );
                }
            }
        }

        return new Uint8Array(
            output
        );
    }

    function decodeLZ77(
        bytes
    ) {
        var output = [];
        var index = 0;

        while (
            index < bytes.length
        ) {
            var control =
                bytes[index++];

            for (
                var bit = 0;
                bit < 8 &&
                index < bytes.length;
                bit++
            ) {
                if (
                    control &
                    (1 << bit)
                ) {
                    var distance =
                        bytes[index] |
                        (bytes[index + 1] << 8);

                    index += 2;

                    var length =
                        bytes[index++];

                    if (
                        distance <= 0 ||
                        distance >
                            output.length
                    ) {
                        throw new Error(
                            "Invalid LZ77 distance."
                        );
                    }

                    for (
                        var n = 0;
                        n < length;
                        n++
                    ) {
                        output.push(
                            output[
                                output.length -
                                distance
                            ]
                        );
                    }
                } else {
                    output.push(
                        bytes[index++]
                    );
                }
            }
        }

        return new Uint8Array(
            output
        );
    }

    for (
        var i = methods.length - 1;
        i >= 0;
        i--
    ) {
        switch (methods[i]) {
            case "delta":
                current =
                    decodeDelta(
                        current
                    );
                break;

            case "zigzag-varint":
                current =
                    decodeZigzagVarintDelta(
                        current
                    );
                break;

            case "varint":
                current =
                    decodeVarInt(
                        current
                    );
                break;

            case "rle":
                current =
                    decodeRLE(
                        current
                    );
                break;

            case "lz77":
                current =
                    decodeLZ77(
                        current
                    );
                break;
        }
    }

    if (
        current.length !==
        rawLength
    ) {
        throw new Error(
            "RBP decompression size mismatch."
        );
    }

    return current;
}function importRBPFile(buffer) {
    var bytes =
        new Uint8Array(buffer);

    if (
        bytes.length >= 4 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x42 &&
        bytes[2] === 0x50 &&
        bytes[3] === 0x32
    ) {
        bytes =
            decodeRBPCompression(
                bytes
            );
    }

    importRBP(bytes);

    return true;
}