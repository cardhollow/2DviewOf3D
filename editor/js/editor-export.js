function exportGeometry() {
    closeMenus();

    if (!selected) {
        alert("No object selected.");
        return;
    }

    if (selected.geometry === undefined) {
        alert("The selected object doesn't have geometry.");
        return;
    }

    var output = selected.geometry.toJSON();

    try {
        output = JSON.stringify(output, parseNumber, "\t");
        output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, "$1");
    } catch(error) {
        output = JSON.stringify(output);
    }

    saveString(output, "geometry.json");
    statusElement.textContent = "Geometry exported";
}function exportObject() {
    closeMenus();

    if (!selected) {
        alert("No object selected.");
        return;
    }

    var output = selected.toJSON();

    try {
        output = JSON.stringify(output, parseNumber, "\t");
        output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, "$1");
    } catch(error) {
        output = JSON.stringify(output);
    }

    saveString(output, "model.json");
    statusElement.textContent = "Object exported";
}function exportSceneJSON() {
    closeMenus();

    var output = serializeScene();

    try {
        output = JSON.stringify(output, parseNumber, "\t");
        output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, "$1");
    } catch(error) {
        output = JSON.stringify(output);
    }

    saveString(output, "scene.json");
    statusElement.textContent = "Scene exported";
}function exportOBJ() {
    closeMenus();

    if (typeof THREE.OBJExporter !== "function") {
        alert("OBJExporter is not available in this Three.js build.");
        return;
    }

    var exporter = new THREE.OBJExporter();
    var group = createExportGroup();

    saveString(
        exporter.parse(group),
        "model.obj"
    );

    statusElement.textContent = "OBJ exported";
}function exportSTL() {
    closeMenus();

    if (typeof THREE.STLExporter !== "function") {
        alert("STLExporter is not available in this Three.js build.");
        return;
    }

    var exporter = new THREE.STLExporter();
    var group = createExportGroup();
    var result = exporter.parse(group);

    if (typeof result === "string") {
        saveString(result, "model.stl");
    } else {
        saveBlob(
            new Blob([result], {type: "application/octet-stream"}),
            "model.stl"
        );
    }

    statusElement.textContent = "STL exported";
}function getHRMP() {
    var objects = getEditorObjects();

    var output = {
        format: "HRMP",
        version: 1,
        vertices: [],
        faces: [],
        edges: []
    };

    var vertexMap = {};
    var edgeMap = {};

    function vertexKey(x, y, z) {
        return (
            number(x) + "," +
            number(y) + "," +
            number(z)
        );
    }

    function addVertex(x, y, z) {
        x = number(x);
        y = number(y);
        z = number(z);

        var key = vertexKey(x, y, z);

        if (vertexMap[key] !== undefined) {
            return vertexMap[key];
        }

        var index = output.vertices.length;

        output.vertices.push([
            x,
            y,
            z
        ]);

        vertexMap[key] = index;

        return index;
    }

    function getColor(object) {
        if (
            object.material &&
            object.material.color
        ) {
            return object.material.color
                .getHexString()
                .toUpperCase();
        }

        return "FFFFFF";
    }

    function addEdge(a, b, color) {
        if (a === b) {
            return;
        }

        var min = Math.min(a, b);
        var max = Math.max(a, b);

        var key = min + ":" + max;

        if (edgeMap[key] !== undefined) {
            return;
        }

        edgeMap[key] = true;

        output.edges.push({
            vertices: [a, b],
            edge: true,
            edgeColor: color,
            isClose: false
        });
    }

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];

        if (!object.geometry) {
            continue;
        }

        object.updateMatrixWorld(true);

        var geometry = object.geometry;
        var color = getColor(object);

        if (
            !geometry.vertices ||
            !geometry.faces
        ) {
            continue;
        }

        var localToExport = [];

        for (
            var v = 0;
            v < geometry.vertices.length;
            v++
        ) {
            var originalVertex =
                geometry.vertices[v];

            var vertex =
                originalVertex.clone();

            vertex.applyMatrix4(
                object.matrixWorld
            );

            localToExport.push(
                addVertex(
                    vertex.x,
                    vertex.y,
                    vertex.z
                )
            );
        }

        for (
            var f = 0;
            f < geometry.faces.length;
            f++
        ) {
            var face = geometry.faces[f];

            var a =
                localToExport[face.a];

            var b =
                localToExport[face.b];

            var c =
                localToExport[face.c];

            if (
                a === undefined ||
                b === undefined ||
                c === undefined
            ) {
                continue;
            }

            output.faces.push({
                vertices: [
                    a,
                    b,
                    c
                ],
                surface: true,
                edge: false,
                surfaceColor: color
            });

            addEdge(a, b, color);
            addEdge(b, c, color);
            addEdge(c, a, color);
        }
    }

    return output;
}function exportHRMP() {
    closeMenus();

    try {
        var output = getHRMP();

        var text = JSON.stringify(
            output,
            null,
            2
        );

        saveString(
            text,
            "model.hrmp.json"
        );

        statusElement.textContent =
            "HRMP exported";

    } catch (error) {
        alert(
            "Could not export HRMP:\n" +
            error.message
        );

        console.error(
            "HRMP export error:",
            error
        );
    }
}function getRBPData() {
    var objects = getEditorObjects();

    var definitions = [];
    var definitionMap = {};
    var colors = [];
    var colorMap = {};
    var attributeDefinitions = [];
    var attributeMap = {};
    var transformDefinitions = [];
    var transformMap = {};
    var tagDefinitions = [];
    var tagMap = {};
    var program = [];

    function number(value) {
        return parseFloat(Number(value).toFixed(6));
    }

    function arrayEqual(a, b) {
        if (!a || !b || a.length !== b.length) {
            return false;
        }

        for (var i = 0; i < a.length; i++) {
            if (number(a[i]) !== number(b[i])) {
                return false;
            }
        }

        return true;
    }

    function getColor(object) {
        if (
            object.material &&
            object.material.color
        ) {
            return object.material.color
                .getHexString()
                .toUpperCase();
        }

        return "FFFFFF";
    }

    function getColorId(color) {
        color = String(color || "FFFFFF").toUpperCase();

        if (colorMap[color] !== undefined) {
            return colorMap[color];
        }

        var id = colors.length;

        colors.push(color);
        colorMap[color] = id;

        return id;
    }

    function getAttributeId(object) {
        var colorId = getColorId(
            getColor(object)
        );

        var attribute = {
            surface: true,
            edge: false,
            color: colorId
        };

        var key = JSON.stringify(attribute);

        if (attributeMap[key] !== undefined) {
            return attributeMap[key];
        }

        var id = attributeDefinitions.length;

        attributeDefinitions.push({
            id: id,
            surface: attribute.surface,
            edge: attribute.edge,
            color: attribute.color
        });

        attributeMap[key] = id;

        return id;
    }

    function getTagId(object) {
        var tags = Array.isArray(object.userData.tags)
            ? object.userData.tags
                .map(function(tag) { return String(tag).trim(); })
                .filter(function(tag) { return tag.length > 0; })
            : [];

        var seen = Object.create(null);
        var uniqueTags = [];

        for (var i = 0; i < tags.length; i++) {
            if (!seen[tags[i]]) {
                seen[tags[i]] = true;
                uniqueTags.push(tags[i]);
            }
        }

        uniqueTags.sort();

        if (!uniqueTags.length) {
            return null;
        }

        var key = JSON.stringify(uniqueTags);

        if (tagMap[key] !== undefined) {
            return tagMap[key];
        }

        var id = tagDefinitions.length;

        tagDefinitions.push({
            id: id,
            values: uniqueTags
        });

        tagMap[key] = id;

        return id;
    }

    function getTransformId(object) {
        var transform = {
            rotation: [
                number(object.rotation.x),
                number(object.rotation.y),
                number(object.rotation.z)
            ],
            scale: [
                number(object.scale.x),
                number(object.scale.y),
                number(object.scale.z)
            ]
        };

        var key = JSON.stringify(transform);

        if (transformMap[key] !== undefined) {
            return transformMap[key];
        }

        var id = transformDefinitions.length;

        transformDefinitions.push({
            id: id,
            rotation: transform.rotation,
            scale: transform.scale
        });

        transformMap[key] = id;

        return id;
    }

    function createEdgeList(geometry) {
        var edges = [];
        var edgeMap = {};

        function addEdge(a, b) {
            var min = Math.min(a, b);
            var max = Math.max(a, b);
            var key = min + ":" + max;

            if (edgeMap[key] !== undefined) {
                return;
            }

            edgeMap[key] = true;

            edges.push({
                vertices: [a, b],
                edge: true,
                closed: false
            });
        }

        for (var i = 0; i < geometry.faces.length; i++) {
            var face = geometry.faces[i];

            addEdge(face.a, face.b);
            addEdge(face.b, face.c);
            addEdge(face.c, face.a);
        }

        return edges;
    }

    function geometrySignature(object) {
        var geometry = object.geometry;

        if (
            !geometry ||
            !geometry.vertices ||
            !geometry.faces
        ) {
            return null;
        }

        var vertices = [];
        var faces = [];

        for (var i = 0; i < geometry.vertices.length; i++) {
            var vertex = geometry.vertices[i];

            vertices.push([
                number(vertex.x),
                number(vertex.y),
                number(vertex.z)
            ]);
        }

        for (var j = 0; j < geometry.faces.length; j++) {
            var face = geometry.faces[j];

            faces.push([
                face.a,
                face.b,
                face.c
            ]);
        }

        return JSON.stringify({
            vertices: vertices,
            faces: faces
        });
    }

    function createDefinition(object) {
        var geometry = object.geometry;
        var attributeId = getAttributeId(object);

        var definition = {
            id: definitions.length,

            objects: [
                {
                    type: "Obj",

                    vertices: [],

                    faces: [],

                    edges: createEdgeList(
                        geometry
                    ),

                    attributes: {
                        default: attributeId
                    },

                    references: []
                }
            ]
        };

        var definitionObject =
            definition.objects[0];

        for (
            var i = 0;
            i < geometry.vertices.length;
            i++
        ) {
            var vertex =
                geometry.vertices[i];

            definitionObject.vertices.push([
                number(vertex.x),
                number(vertex.y),
                number(vertex.z)
            ]);
        }

        for (
            var j = 0;
            j < geometry.faces.length;
            j++
        ) {
            var face =
                geometry.faces[j];

            definitionObject.faces.push({
                vertices: [
                    face.a,
                    face.b,
                    face.c
                ],
                surface: true,
                edge: false
            });
        }

        definitions.push(definition);

        return definition.id;
    }

    function getDefinition(object) {
        var signature =
            geometrySignature(object);

        if (signature === null) {
            return -1;
        }

        if (
            definitionMap[signature] !== undefined
        ) {
            return definitionMap[signature];
        }

        var id = createDefinition(object);

        definitionMap[signature] = id;

        return id;
    }

    function getProgramReference(
        object,
        definitionId
    ) {
        var attributeId =
            getAttributeId(object);

        var transformId =
            getTransformId(object);

        var tagId =
            getTagId(object);

        var definition =
            definitions[definitionId];

        var defaultAttributeId =
            definition.objects[0]
                .attributes.default;

        var instruction = {
            op: "reference",
            target: definitionId,

            position: [
                number(object.position.x),
                number(object.position.y),
                number(object.position.z)
            ],

            transform: transformId,

            attributes: null,

            tags: tagId
        };

        if (
            attributeId !==
            defaultAttributeId
        ) {
            instruction.attributes =
                attributeId;
        }

        return instruction;
    }

    for (
        var i = 0;
        i < objects.length;
        i++
    ) {
        var object = objects[i];

        if (!object.geometry) {
            continue;
        }

        object.updateMatrixWorld(true);

        var definitionId =
            getDefinition(object);

        if (definitionId < 0) {
            continue;
        }

        program.push(
            getProgramReference(
                object,
                definitionId
            )
        );
    }

    return {
        format: "RBP",
        version: 1,

        definitions: definitions,

        colors: colors,

        attributes: attributeDefinitions,

        transforms: transformDefinitions,

        tags: tagDefinitions,

        program: program
    };
}function optimizeRBP(data) {
    var program = data.program;
    var optimized = [];

    function sameNumber(a, b) {
        return Math.abs(a - b) < 0.000001;
    }

    function sameArray(a, b) {
        if (!a || !b || a.length !== b.length) {
            return false;
        }

        for (var i = 0; i < a.length; i++) {
            if (!sameNumber(a[i], b[i])) {
                return false;
            }
        }

        return true;
    }

    function number(value) {
        return parseFloat(Number(value).toFixed(6));
    }

    function sameReferenceAttributes(a, b) {
        return (
            a.target === b.target &&
            a.transform === b.transform &&
            a.attributes === b.attributes &&
            a.tags === b.tags
        );
    }

    function getInterval(a, b) {
        return [
            number(
                b.position[0] -
                a.position[0]
            ),
            number(
                b.position[1] -
                a.position[1]
            ),
            number(
                b.position[2] -
                a.position[2]
            )
        ];
    }

    function positionAt(
        start,
        interval,
        index
    ) {
        return [
            number(
                start[0] +
                interval[0] * index
            ),
            number(
                start[1] +
                interval[1] * index
            ),
            number(
                start[2] +
                interval[2] * index
            )
        ];
    }

    for (
        var i = 0;
        i < program.length;
    ) {
        var first = program[i];

        if (
            first.op !== "reference"
        ) {
            optimized.push(first);
            i++;
            continue;
        }

        if (
            i + 2 >= program.length
        ) {
            optimized.push(first);
            i++;
            continue;
        }

        var second =
            program[i + 1];

        if (
            second.op !== "reference" ||
            !sameReferenceAttributes(
                first,
                second
            )
        ) {
            optimized.push(first);
            i++;
            continue;
        }

        var interval =
            getInterval(
                first,
                second
            );

        if (
            sameArray(
                interval,
                [0, 0, 0]
            )
        ) {
            optimized.push(first);
            i++;
            continue;
        }

        var count = 2;

        while (
            i + count <
            program.length
        ) {
            var next =
                program[i + count];

            if (
                next.op !== "reference"
            ) {
                break;
            }

            if (
                !sameReferenceAttributes(
                    first,
                    next
                )
            ) {
                break;
            }

            var expected =
                positionAt(
                    first.position,
                    interval,
                    count
                );

            if (
                !sameArray(
                    expected,
                    next.position
                )
            ) {
                break;
            }

            count++;
        }

        if (count >= 3) {
            optimized.push({
                op: "repeat",

                target: first.target,

                start: [
                    first.position[0],
                    first.position[1],
                    first.position[2]
                ],

                interval: interval,

                count: count,

                transform:
                    first.transform,

                attributes:
                    first.attributes,

                tags:
                    first.tags
            });

            i += count;
            continue;
        }

        optimized.push(first);
        i++;
    }

    data.program = optimized;

    return data;
}function writeRBPBinary(data) {
    var output = [];

    var OP_DEFINE = 1;
    var OP_OBJECT = 2;
    var OP_VERTEX = 3;
    var OP_FACE = 4;
    var OP_EDGE = 5;
    var OP_DEFREF = 6;
    var OP_COLOR = 7;
    var OP_ATTRIBUTE = 8;
    var OP_TRANSFORM = 9;
    var OP_REFERENCE = 16;
    var OP_REPEAT = 17;
    var OP_END = 255;

    var RBP_FEATURE_TAGS = 1;

    function pushUint8(value) {
        output.push(
            Number(value) & 255
        );
    }

    function pushUint16(value) {
        value =
            Number(value) >>> 0;

        output.push(
            value & 255,
            (value >> 8) & 255
        );
    }

    function pushUint32(value) {
        value =
            Number(value) >>> 0;

        output.push(
            value & 255,
            (value >>> 8) & 255,
            (value >>> 16) & 255,
            (value >>> 24) & 255
        );
    }

    function pushFloat32(value) {
        var buffer =
            new ArrayBuffer(4);

        var view =
            new DataView(buffer);

        view.setFloat32(
            0,
            Number(value) || 0,
            true
        );

        var bytes =
            new Uint8Array(buffer);

        for (
            var i = 0;
            i < bytes.length;
            i++
        ) {
            output.push(bytes[i]);
        }
    }

    function pushColor(id) {
        pushUint16(id);
    }

    function pushVector3(vector) {
        pushFloat32(vector[0]);
        pushFloat32(vector[1]);
        pushFloat32(vector[2]);
    }

    function pushString(value) {
        var bytes =
            new TextEncoder().encode(String(value));

        pushUint16(bytes.length);

        for (var i = 0; i < bytes.length; i++) {
            pushUint8(bytes[i]);
        }
    }

    output.push(
        0x52,
        0x42,
        0x50,
        0x01
    );

    pushUint16(data.version);

    pushUint16(RBP_FEATURE_TAGS);

    pushUint32(
        data.definitions.length
    );

    pushUint32(
        data.colors.length
    );

    pushUint32(
        data.attributes.length
    );

    pushUint32(
        data.transforms.length
    );

    pushUint32(
        data.tags ? data.tags.length : 0
    );

    pushUint32(
        data.program.length
    );

    for (
        var c = 0;
        c < data.colors.length;
        c++
    ) {
        var color =
            parseInt(
                data.colors[c],
                16
            );

        if (isNaN(color)) {
            color = 0xffffff;
        }

        pushUint8(
            (color >> 16) & 255
        );

        pushUint8(
            (color >> 8) & 255
        );

        pushUint8(
            color & 255
        );
    }

    for (
        var a = 0;
        a < data.attributes.length;
        a++
    ) {
        var attribute =
            data.attributes[a];

        var flags = 0;

        if (attribute.surface) {
            flags |= 1;
        }

        if (attribute.edge) {
            flags |= 2;
        }

        pushUint8(flags);

        pushColor(
            attribute.color
        );
    }

    for (
        var t = 0;
        t < data.transforms.length;
        t++
    ) {
        var transform =
            data.transforms[t];

        pushVector3(
            transform.rotation
        );

        pushVector3(
            transform.scale
        );
    }

    for (
        var g = 0;
        g < (data.tags ? data.tags.length : 0);
        g++
    ) {
        var tagDefinition =
            data.tags[g];

        pushUint32(
            tagDefinition.id
        );

        pushUint16(
            tagDefinition.values.length
        );

        for (
            var tv = 0;
            tv < tagDefinition.values.length;
            tv++
        ) {
            pushString(
                tagDefinition.values[tv]
            );
        }
    }

    for (
        var d = 0;
        d < data.definitions.length;
        d++
    ) {
        var definition =
            data.definitions[d];

        pushUint8(OP_DEFINE);

        pushUint32(
            definition.id
        );

        pushUint32(
            definition.objects.length
        );

        for (
            var o = 0;
            o < definition.objects.length;
            o++
        ) {
            var object =
                definition.objects[o];

            pushUint8(OP_OBJECT);

            pushUint32(
                object.vertices.length
            );

            for (
                var v = 0;
                v < object.vertices.length;
                v++
            ) {
                pushUint32(v);

                pushVector3(
                    object.vertices[v]
                );
            }

            pushUint32(
                object.faces.length
            );

            for (
                var f = 0;
                f < object.faces.length;
                f++
            ) {
                var face =
                    object.faces[f];

                pushUint8(OP_FACE);

                pushUint32(
                    face.vertices.length
                );

                for (
                    var fv = 0;
                    fv < face.vertices.length;
                    fv++
                ) {
                    pushUint32(
                        face.vertices[fv]
                    );
                }

                var faceFlags = 0;

                if (face.surface) {
                    faceFlags |= 1;
                }

                if (face.edge) {
                    faceFlags |= 2;
                }

                pushUint8(faceFlags);
            }

            pushUint32(
                object.edges.length
            );

            for (
                var e = 0;
                e < object.edges.length;
                e++
            ) {
                var edge =
                    object.edges[e];

                pushUint8(OP_EDGE);

                pushUint32(
                    edge.vertices[0]
                );

                pushUint32(
                    edge.vertices[1]
                );

                pushUint8(
                    edge.edge ? 1 : 0
                );

                pushUint8(
                    edge.closed ? 1 : 0
                );
            }

            pushUint32(
                object.attributes.default
            );

            pushUint32(
                object.references.length
            );

            for (
                var r = 0;
                r < object.references.length;
                r++
            ) {
                var reference =
                    object.references[r];

                pushUint8(OP_DEFREF);

                pushUint32(
                    reference.definition
                );
            }
        }

        pushUint8(OP_END);
    }

    for (
        var p = 0;
        p < data.program.length;
        p++
    ) {
        var instruction =
            data.program[p];

        if (
            instruction.op ===
            "reference"
        ) {
            pushUint8(
                OP_REFERENCE
            );

            pushUint32(
                instruction.target
            );

            pushVector3(
                instruction.position
            );

            pushUint32(
                instruction.transform
            );

            pushUint32(
                instruction.attributes === null
                    ? 0xffffffff
                    : instruction.attributes
            );

            pushUint32(
                instruction.tags === null || instruction.tags === undefined
                    ? 0xffffffff
                    : instruction.tags
            );
        }

        if (
            instruction.op ===
            "repeat"
        ) {
            pushUint8(
                OP_REPEAT
            );

            pushUint32(
                instruction.target
            );

            pushVector3(
                instruction.start
            );

            pushVector3(
                instruction.interval
            );

            pushUint32(
                instruction.count
            );

            pushUint32(
                instruction.transform
            );

            pushUint32(
                instruction.attributes === null
                    ? 0xffffffff
                    : instruction.attributes
            );

            pushUint32(
                instruction.tags === null || instruction.tags === undefined
                    ? 0xffffffff
                    : instruction.tags
            );
        }
    }

    pushUint8(OP_END);

    return new Uint8Array(output);
}function deltaEncodeBytes(bytes) {
    var output =
        new Uint8Array(
            bytes.length
        );

    if (!bytes.length) {
        return output;
    }

    output[0] = bytes[0];

    for (
        var i = 1;
        i < bytes.length;
        i++
    ) {
        output[i] =
            (
                bytes[i] -
                bytes[i - 1] +
                256
            ) & 255;
    }

    return output;
}function zigzagEncode(value) {
    value = Number(value) | 0;

    return (
        value < 0
            ? (-value * 2) - 1
            : value * 2
    ) >>> 0;
}function writeVarInt(value, output) {
    value =
        Number(value) >>> 0;

    while (value >= 128) {
        output.push(
            (value & 127) | 128
        );

        value =
            Math.floor(
                value / 128
            );
    }

    output.push(value);
}function zigzagVarintDelta(bytes) {
    var output = [];

    if (!bytes.length) {
        return new Uint8Array(0);
    }

    var previous = 0;

    for (
        var i = 0;
        i < bytes.length;
        i++
    ) {
        var current =
            bytes[i];

        var delta =
            current -
            previous;

        previous =
            current;

        writeVarInt(
            zigzagEncode(delta),
            output
        );
    }

    return new Uint8Array(output);
}function varIntEncodeBytes(bytes) {
    var output = [];

    for (
        var i = 0;
        i < bytes.length;
        i++
    ) {
        writeVarInt(
            bytes[i],
            output
        );
    }

    return new Uint8Array(output);
}function rleEncodeBytes(bytes) {
    var output = [];

    var i = 0;

    while (i < bytes.length) {
        var runLength = 1;

        while (
            i + runLength <
                bytes.length &&
            bytes[i + runLength] ===
                bytes[i] &&
            runLength < 128
        ) {
            runLength++;
        }

        if (runLength >= 3) {
            output.push(
                0x80 |
                (runLength - 1)
            );

            output.push(
                bytes[i]
            );

            i += runLength;
            continue;
        }

        var start = i;
        var literalLength = 0;

        while (
            i < bytes.length &&
            literalLength < 128
        ) {
            if (
                i + 2 <
                    bytes.length &&
                bytes[i] ===
                    bytes[i + 1] &&
                bytes[i] ===
                    bytes[i + 2]
            ) {
                break;
            }

            i++;
            literalLength++;
        }

        if (literalLength === 0) {
            i++;
            literalLength = 1;
        }

        output.push(
            literalLength - 1
        );

        for (
            var j = 0;
            j < literalLength;
            j++
        ) {
            output.push(
                bytes[start + j]
            );
        }
    }

    return new Uint8Array(output);
}function lz77EncodeBytes(bytes) {
    var output = [];

    var windowSize = 4096;
    var maxLength = 255;
    var minimumMatch = 4;
    var maxCandidates = 32;

    var index = {};
    var i = 0;

    function keyAt(position) {
        if (
            position + 2 >=
            bytes.length
        ) {
            return null;
        }

        return (
            bytes[position] + "," +
            bytes[position + 1] + "," +
            bytes[position + 2]
        );
    }

    function addIndex(position) {
        var key =
            keyAt(position);

        if (key === null) {
            return;
        }

        if (!index[key]) {
            index[key] = [];
        }

        index[key].push(position);

        while (
            index[key].length &&
            position -
                index[key][0] >
                windowSize
        ) {
            index[key].shift();
        }

        if (
            index[key].length >
            maxCandidates
        ) {
            index[key].splice(
                0,
                index[key].length -
                maxCandidates
            );
        }
    }

    while (i < bytes.length) {
        var controlIndex =
            output.length;

        output.push(0);

        var control = 0;

        for (
            var bit = 0;
            bit < 8 &&
            i < bytes.length;
            bit++
        ) {
            var bestLength =
                0;

            var bestDistance =
                0;

            var key =
                keyAt(i);

            if (key && index[key]) {
                var candidates =
                    index[key];

                for (
                    var c =
                        candidates.length -
                        1;

                    c >= 0;

                    c--
                ) {
                    var position =
                        candidates[c];

                    var distance =
                        i - position;

                    if (
                        distance <= 0 ||
                        distance >
                            windowSize
                    ) {
                        continue;
                    }

                    var length = 0;

                    while (
                        length <
                            maxLength &&
                        i + length <
                            bytes.length &&
                        bytes[
                            position +
                            length
                        ] ===
                            bytes[
                            i + length
                        ]
                    ) {
                        length++;

                        if (
                            position +
                            length >=
                            i
                        ) {
                            break;
                        }
                    }

                    while (
                        length <
                            maxLength &&
                        i + length <
                            bytes.length &&
                        bytes[
                            position +
                            length
                        ] ===
                            bytes[
                            i + length
                        ]
                    ) {
                        length++;
                    }

                    if (
                        length >
                        bestLength
                    ) {
                        bestLength =
                            length;

                        bestDistance =
                            distance;

                        if (
                            length ===
                            maxLength
                        ) {
                            break;
                        }
                    }
                }
            }

            if (
                bestLength >=
                minimumMatch
            ) {
                control |=
                    1 << bit;

                output.push(
                    bestDistance & 255,
                    (bestDistance >> 8) & 255,
                    bestLength
                );

                for (
                    var m = 0;
                    m < bestLength;
                    m++
                ) {
                    addIndex(i);
                    i++;
                }
            } else {
                output.push(
                    bytes[i]
                );

                addIndex(i);
                i++;
            }
        }

        output[controlIndex] =
            control;
    }

    return new Uint8Array(output);
}function getCompressedCandidate(
    bytes,
    method
) {
    switch (method) {
        case "delta":
            return deltaEncodeBytes(
                bytes
            );

        case "zigzag-varint":
            return zigzagVarintDelta(
                bytes
            );

        case "varint":
            return varIntEncodeBytes(
                bytes
            );

        case "rle":
            return rleEncodeBytes(
                bytes
            );

        case "lz77":
            return lz77EncodeBytes(
                bytes
            );

        default:
            return bytes;
    }
}function compressRBPRepeatedly(
    bytes
) {
    var methods = [
        "lz77",
        "rle",
        "delta",
        "zigzag-varint",
        "varint"
    ];

    var current =
        new Uint8Array(bytes);

    var applied = [];

    for (var round = 0; round < 16; round++) {
        var best =
            current;

        var bestMethod =
            null;

        for (
            var i = 0;
            i < methods.length;
            i++
        ) {
            var candidate =
                getCompressedCandidate(
                    current,
                    methods[i]
                );

            if (
                candidate.length <
                best.length
            ) {
                best =
                    candidate;

                bestMethod =
                    methods[i];
            }
        }

        if (
            !bestMethod ||
            best.length >=
                current.length
        ) {
            break;
        }

        current = best;

        applied.push(
            bestMethod
        );
    }

    return {
        bytes: current,
        methods: applied
    };
}function buildRBPFile(
    rawBytes,
    compressedBytes,
    methods
) {
    var output = [];

    function pushUint8(value) {
        output.push(
            Number(value) & 255
        );
    }

    function pushUint16(value) {
        value =
            Number(value) >>> 0;

        output.push(
            value & 255,
            (value >> 8) & 255
        );
    }

    function pushUint32(value) {
        value =
            Number(value) >>> 0;

        output.push(
            value & 255,
            (value >>> 8) & 255,
            (value >>> 16) & 255,
            (value >>> 24) & 255
        );
    }

    var methodIds = {
        delta: 1,
        "zigzag-varint": 2,
        varint: 3,
        rle: 4,
        lz77: 5
    };

    output.push(
        0x52,
        0x42,
        0x50,
        0x32
    );

    pushUint16(1);

    pushUint16(
        methods.length
            ? 1
            : 0
    );

    pushUint32(
        rawBytes.length
    );

    pushUint32(
        compressedBytes.length
    );

    pushUint16(
        methods.length
    );

    for (
        var i = 0;
        i < methods.length;
        i++
    ) {
        pushUint8(
            methodIds[
                methods[i]
            ]
        );
    }

    for (
        var j = 0;
        j < compressedBytes.length;
        j++
    ) {
        output.push(
            compressedBytes[j]
        );
    }

    return new Uint8Array(output);
}function exportRBP() {
    closeMenus();

    try {
        var data =
            getRBPData();

        data =
            optimizeRBP(data);

        var rawBinary =
            writeRBPBinary(data);

        var compressed =
            compressRBPRepeatedly(
                rawBinary
            );

        var finalBinary =
            buildRBPFile(
                rawBinary,
                compressed.bytes,
                compressed.methods
            );

        saveBlob(
            new Blob(
                [finalBinary],
                {
                    type:
                        "application/octet-stream"
                }
            ),
            "scene.rbp"
        );

        var methodText =
            compressed.methods.length
                ? compressed.methods.join(" → ")
                : "none";

        statusElement.textContent =
            "RBP exported: " +
            finalBinary.length +
            " bytes";

        console.log(
            "RBP data:",
            data
        );

        console.log(
            "RBP compression:",
            methodText
        );

        console.log(
            "RBP raw bytes:",
            rawBinary.length
        );

        console.log(
            "RBP final bytes:",
            compressed.bytes.length
        );

    } catch (error) {
        alert(
            "Could not export RBP:\n" +
            error.message
        );

        console.error(
            "RBP export error:",
            error
        );
    }
}