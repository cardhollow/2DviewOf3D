class Reader {
    constructor(bytes) {
        this.bytes = bytes;
        this.offset = 0;
    }

    check(size) {
        if (this.offset + size > this.bytes.length) {
            throw new Error("Unexpected end of RBP.");
        }
    }

    uint8() {
        this.check(1);
        return this.bytes[this.offset++];
    }

    uint16() {
        this.check(2);
        const value = this.bytes[this.offset] | (this.bytes[this.offset + 1] << 8);
        this.offset += 2;
        return value >>> 0;
    }

    uint32() {
        this.check(4);
        const value = this.bytes[this.offset] | (this.bytes[this.offset + 1] << 8) | (this.bytes[this.offset + 2] << 16) | (this.bytes[this.offset + 3] << 24);
        this.offset += 4;
        return value >>> 0;
    }

    float32() {
        this.check(4);
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setUint8(0,this.bytes[this.offset]);
        view.setUint8(1,this.bytes[this.offset + 1]);
        view.setUint8(2,this.bytes[this.offset + 2]);
        view.setUint8(3,this.bytes[this.offset + 3]);
        this.offset += 4;
        return view.getFloat32(0,true);
    }

    vector3() {
        return [this.float32(),this.float32(),this.float32()];
    }
}function readVarInt(bytes,state) {
    let result = 0;
    let shift = 0;

    while (state.index < bytes.length) {
        const value = bytes[state.index++];
        result |= (value & 127) << shift;

        if (!(value & 128)) {
            return result >>> 0;
        }

        shift += 7;

        if (shift > 35) {
            throw new Error("Invalid VarInt.");
        }
    }

    throw new Error("Unexpected end of VarInt.");
}function zigzagDecode(value) {
    return (value >>> 1) ^ -(value & 1);
}function decodeDelta(bytes) {
    if (!bytes.length) {
        return new Uint8Array(0);
    }

    const output = new Uint8Array(bytes.length);
    output[0] = bytes[0];

    for (let i = 1; i < bytes.length; i++) {
        output[i] = (output[i - 1] + bytes[i]) & 255;
    }

    return output;
}function decodeVarInt(bytes) {
    const output = [];
    const state = {index:0};

    while (state.index < bytes.length) {
        output.push(readVarInt(bytes,state) & 255);
    }

    return new Uint8Array(output);
}function decodeZigzagVarintDelta(bytes) {
    const output = [];
    const state = {index:0};
    let previous = 0;

    while (state.index < bytes.length) {
        const encoded = readVarInt(bytes,state);
        const delta = zigzagDecode(encoded);
        const value = (previous + delta + 256) & 255;
        output.push(value);
        previous = value;
    }

    return new Uint8Array(output);
}function decodeRLE(bytes) {
    const output = [];
    let index = 0;

    while (index < bytes.length) {
        const control = bytes[index++];

        if (control & 0x80) {
            const count = (control & 0x7f) + 1;

            if (index >= bytes.length) {
                throw new Error("Invalid RLE.");
            }

            const value = bytes[index++];

            for (let i = 0; i < count; i++) {
                output.push(value);
            }
        } else {
            const length = control + 1;

            if (index + length > bytes.length) {
                throw new Error("Invalid RLE literal.");
            }

            for (let i = 0; i < length; i++) {
                output.push(bytes[index++]);
            }
        }
    }

    return new Uint8Array(output);
}function decodeLZ77(bytes) {
    const output = [];
    let index = 0;

    while (index < bytes.length) {
        const control = bytes[index++];

        for (let bit = 0; bit < 8 && index < bytes.length; bit++) {
            if (control & (1 << bit)) {
                if (index + 3 > bytes.length) {
                    throw new Error("Invalid LZ77.");
                }

                const distance = bytes[index] | (bytes[index + 1] << 8);
                index += 2;

                const length = bytes[index++];

                if (distance <= 0 || distance > output.length) {
                    throw new Error("Invalid LZ77 distance.");
                }

                for (let n = 0; n < length; n++) {
                    output.push(output[output.length - distance]);
                }
            } else {
                if (index >= bytes.length) {
                    break;
                }

                output.push(bytes[index++]);
            }
        }
    }

    return new Uint8Array(output);
}function decodeRBP2(bytes) {
    const reader = new Reader(bytes);

    if (reader.uint8() !== 0x52 || reader.uint8() !== 0x42 || reader.uint8() !== 0x50 || reader.uint8() !== 0x32) {
        throw new Error("Not RBP2.");
    }

    reader.uint16();
    reader.uint16();

    const rawLength = reader.uint32();
    const compressedLength = reader.uint32();
    const methodCount = reader.uint16();

    const methodNames = {
        1:"delta",
        2:"zigzag",
        3:"varint",
        4:"rle",
        5:"lz77"
    };

    const methods = [];

    for (let i = 0; i < methodCount; i++) {
        const id = reader.uint8();

        if (!methodNames[id]) {
            throw new Error("Unknown compression method.");
        }

        methods.push(methodNames[id]);
    }

    let current = bytes.slice(reader.offset,reader.offset + compressedLength);

    for (let i = methods.length - 1; i >= 0; i--) {
        switch (methods[i]) {
            case "delta":
                current = decodeDelta(current);
                break;
            case "zigzag":
                current = decodeZigzagVarintDelta(current);
                break;
            case "varint":
                current = decodeVarInt(current);
                break;
            case "rle":
                current = decodeRLE(current);
                break;
            case "lz77":
                current = decodeLZ77(current);
                break;
        }
    }

    if (current.length !== rawLength) {
        throw new Error("RBP2 decompression size mismatch.");
    }

    return current;
}function parseRBP1(bytes) {
    let offset = 0;

    function check(size) {
        if (offset + size > bytes.length) {
            throw new Error("Unexpected end of RBP.");
        }
    }

    function uint8() {
        check(1);
        return bytes[offset++];
    }

    function uint16() {
        check(2);
        const value = bytes[offset] | (bytes[offset + 1] << 8);
        offset += 2;
        return value >>> 0;
    }

    function uint32() {
        check(4);
        const value =
            bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24);
        offset += 4;
        return value >>> 0;
    }

    function float32() {
        check(4);
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);

        view.setUint8(0,bytes[offset]);
        view.setUint8(1,bytes[offset + 1]);
        view.setUint8(2,bytes[offset + 2]);
        view.setUint8(3,bytes[offset + 3]);

        offset += 4;
        return view.getFloat32(0,true);
    }

    function vector3() {
        return [float32(),float32(),float32()];
    }

    function string() {
        const length = uint16();
        check(length);

        const value = new TextDecoder().decode(
            bytes.slice(offset,offset + length)
        );

        offset += length;
        return value;
    }

    if (
        uint8() !== 0x52 ||
        uint8() !== 0x42 ||
        uint8() !== 0x50
    ) {
        throw new Error("Not an RBP file.");
    }

    const versionByte = uint8();

    if (versionByte !== 0x01) {
        throw new Error("Unsupported RBP version.");
    }

    const version = uint16();
    const featureFlags = uint16();

    // Bit 0 is the tag feature flag used by the updated editor.
    const hasTags = !!(featureFlags & 1);

    const definitionCount = uint32();
    const colorCount = uint32();
    const attributeCount = uint32();
    const transformCount = uint32();
    const tagCount = hasTags ? uint32() : 0;
    const programCount = uint32();

    const colors = [];

    for (let i = 0; i < colorCount; i++) {
        const r = uint8();
        const g = uint8();
        const b = uint8();

        colors.push(
            ((r << 16) | (g << 8) | b) >>> 0
        );
    }

    const attributes = [];

    for (let i = 0; i < attributeCount; i++) {
        const flags = uint8();
        const color = uint16();

        attributes.push({
            surface: !!(flags & 1),
            edge: !!(flags & 2),
            color: color
        });
    }

    const transforms = [];

    for (let i = 0; i < transformCount; i++) {
        transforms.push({
            rotation: vector3(),
            scale: vector3()
        });
    }

    const tags = [];

    for (let i = 0; i < tagCount; i++) {
        const tagId = uint32();
        const valueCount = uint16();
        const values = [];

        for (let t = 0; t < valueCount; t++) {
            values.push(string());
        }

        tags.push({
            id: tagId,
            values: values
        });
    }

    const definitions = [];

    for (let d = 0; d < definitionCount; d++) {
        if (uint8() !== 1) {
            throw new Error("Invalid definition opcode.");
        }

        const definitionId = uint32();
        const objectCount = uint32();

        const definition = {
            id: definitionId,
            objects: []
        };

        for (let o = 0; o < objectCount; o++) {
            if (uint8() !== 2) {
                throw new Error("Invalid object opcode.");
            }

            const vertexCount = uint32();
            const vertices = [];

            for (let v = 0; v < vertexCount; v++) {
                uint32();
                vertices.push(vector3());
            }

            const faceCount = uint32();
            const faces = [];

            for (let f = 0; f < faceCount; f++) {
                if (uint8() !== 4) {
                    throw new Error("Invalid face opcode.");
                }

                const count = uint32();
                const indices = [];

                for (let n = 0; n < count; n++) {
                    indices.push(uint32());
                }

                const flags = uint8();

                faces.push({
                    vertices: indices,
                    surface: !!(flags & 1),
                    edge: !!(flags & 2)
                });
            }

            const edgeCount = uint32();

            for (let e = 0; e < edgeCount; e++) {
                if (uint8() !== 5) {
                    throw new Error("Invalid edge opcode.");
                }

                uint32();
                uint32();
                uint8();
                uint8();
            }

            const defaultAttribute = uint32();
            const referenceCount = uint32();
            const references = [];

            for (let r = 0; r < referenceCount; r++) {
                if (uint8() !== 6) {
                    throw new Error("Invalid reference opcode.");
                }

                references.push({
                    definition: uint32()
                });
            }

            definition.objects.push({
                vertices: vertices,
                faces: faces,
                defaultAttribute: defaultAttribute,
                references: references
            });
        }

        if (uint8() !== 255) {
            throw new Error("Invalid definition terminator.");
        }

        definitions.push(definition);
    }

    const program = [];

    for (let p = 0; p < programCount; p++) {
        const opcode = uint8();

        if (opcode === 16) {
            program.push({
                type: "reference",
                target: uint32(),
                position: vector3(),
                transform: uint32(),
                attributes: uint32(),
                tags: hasTags ? uint32() : 0xffffffff
            });
        } else if (opcode === 17) {
            program.push({
                type: "repeat",
                target: uint32(),
                start: vector3(),
                interval: vector3(),
                count: uint32(),
                transform: uint32(),
                attributes: uint32(),
                tags: hasTags ? uint32() : 0xffffffff
            });
        } else {
            throw new Error("Invalid program opcode.");
        }
    }

    return {
        version: version,
        featureFlags: featureFlags,
        colors: colors,
        attributes: attributes,
        transforms: transforms,
        tags: tags,
        definitions: definitions,
        program: program
    };
}function rotatePoint(x,y,z,rotation) {
    let px = x;
    let py = y;
    let pz = z;

    let c = Math.cos(rotation[0]);
    let s = Math.sin(rotation[0]);

    let ny = py * c - pz * s;
    let nz = py * s + pz * c;

    py = ny;
    pz = nz;

    c = Math.cos(rotation[1]);
    s = Math.sin(rotation[1]);

    let nx = px * c + pz * s;
    nz = -px * s + pz * c;

    px = nx;
    pz = nz;

    c = Math.cos(rotation[2]);
    s = Math.sin(rotation[2]);

    nx = px * c - py * s;
    ny = px * s + py * c;

    return {
        x: nx,
        y: ny,
        z: nz
    };
}function transformPoint(point,transform,position) {
    const scale = transform && transform.scale ? transform.scale : [1,1,1];
    const rotation = transform && transform.rotation ? transform.rotation : [0,0,0];

    const scaled = {
        x: point[0] * scale[0],
        y: point[1] * scale[1],
        z: point[2] * scale[2]
    };

    const rotated = rotatePoint(scaled.x,scaled.y,scaled.z,rotation);

    return {
        x: rotated.x + position[0],
        y: rotated.y + position[1],
        z: rotated.z + position[2]
    };
}function expandRBP(rbp) {
    const definitions = {};
    const triangles = [];

    for (const definition of rbp.definitions) {
        definitions[definition.id] = definition;
    }

    function getColor(attributeId) {
        if (
            attributeId === undefined ||
            attributeId === null ||
            attributeId === 0xffffffff
        ) {
            return 0xffffff;
        }

        const attribute = rbp.attributes[attributeId];

        if (!attribute) {
            return 0xffffff;
        }

        return rbp.colors[attribute.color] === undefined
            ? 0xffffff
            : rbp.colors[attribute.color];
    }

    function resolveTags(tagId) {
        if (
            tagId === undefined ||
            tagId === null ||
            tagId === 0xffffffff
        ) {
            return [];
        }

        for (const tag of rbp.tags) {
            if (tag.id === tagId) {
                return tag.values
                    .map(function(value) {
                        return String(value)
                            .trim()
                            .toLowerCase();
                    })
                    .filter(function(value) {
                        return value.length > 0;
                    });
            }
        }

        return [];
    }

    function appendDefinition(
        definitionId,
        transform,
        position,
        overrideAttribute,
        tagsForObject,
        stack
    ) {
        if (stack[definitionId]) {
            return;
        }

        const definition = definitions[definitionId];

        if (!definition) {
            return;
        }

        stack[definitionId] = true;

        for (const object of definition.objects) {
            const worldVertices = [];

            for (const vertex of object.vertices) {
                worldVertices.push(
                    transformPoint(vertex,transform,position)
                );
            }

            let attributeId = object.defaultAttribute;

            if (
                overrideAttribute !== undefined &&
                overrideAttribute !== null &&
                overrideAttribute !== 0xffffffff
            ) {
                attributeId = overrideAttribute;
            }

            const color = getColor(attributeId);

            for (const face of object.faces) {
                if (
                    face.surface === false ||
                    !face.vertices ||
                    face.vertices.length < 3
                ) {
                    continue;
                }

                const first = face.vertices[0];

                for (
                    let i = 1;
                    i < face.vertices.length - 1;
                    i++
                ) {
                    const a = worldVertices[first];
                    const b = worldVertices[face.vertices[i]];
                    const c = worldVertices[face.vertices[i + 1]];

                    if (!a || !b || !c) {
                        continue;
                    }

                    triangles.push({
                        a: a,
                        b: b,
                        c: c,
                        color: color,
                        tags: tagsForObject.slice()
                    });
                }
            }

            for (const reference of object.references) {
                appendDefinition(
                    reference.definition,
                    transform,
                    position,
                    overrideAttribute,
                    tagsForObject,
                    stack
                );
            }
        }

        delete stack[definitionId];
    }

    for (const instruction of rbp.program) {
        const transform =
            rbp.transforms[instruction.transform] || {
                rotation: [0,0,0],
                scale: [1,1,1]
            };

        const tagsForObject =
            resolveTags(instruction.tags);

        if (instruction.type === "reference") {
            appendDefinition(
                instruction.target,
                transform,
                instruction.position,
                instruction.attributes,
                tagsForObject,
                {}
            );
        } else if (instruction.type === "repeat") {
            for (
                let i = 0;
                i < instruction.count;
                i++
            ) {
                const position = [
                    instruction.start[0] +
                        instruction.interval[0] * i,
                    instruction.start[1] +
                        instruction.interval[1] * i,
                    instruction.start[2] +
                        instruction.interval[2] * i
                ];

                appendDefinition(
                    instruction.target,
                    transform,
                    position,
                    instruction.attributes,
                    tagsForObject,
                    {}
                );
            }
        }
    }

    return triangles;
}function loadRBP(bytes) {
    let raw = bytes;

    if (
        bytes.length >= 4 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x42 &&
        bytes[2] === 0x50 &&
        bytes[3] === 0x32
    ) {
        raw = decodeRBP2(bytes);
    }

    const rbp = parseRBP1(raw);
    const triangles = expandRBP(rbp);

    if (!triangles.length) {
        throw new Error("RBP contains no geometry.");
    }

    model = {
        triangles: triangles,
        taggedTriangles: [],
        tagGroups: {},
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity
    };

    for (const triangle of triangles) {
        for (const point of [
            triangle.a,
            triangle.b,
            triangle.c
        ]) {
            model.minX = Math.min(model.minX,point.x);
            model.maxX = Math.max(model.maxX,point.x);
            model.minY = Math.min(model.minY,point.y);
            model.maxY = Math.max(model.maxY,point.y);
            model.minZ = Math.min(model.minZ,point.z);
            model.maxZ = Math.max(model.maxZ,point.z);
        }

        if (
            Array.isArray(triangle.tags) &&
            triangle.tags.length
        ) {
            model.taggedTriangles.push(triangle);

            for (const tag of triangle.tags) {
                const key = normalizeTag(tag);

                if (!key) {
                    continue;
                }

                if (!model.tagGroups[key]) {
                    model.tagGroups[key] = [];
                }

                model.tagGroups[key].push(triangle);
            }
        }
    }

    if (model.minX === model.maxX) {
        model.minX -= 1;
        model.maxX += 1;
    }

    if (model.minY === model.maxY) {
        model.minY -= 1;
        model.maxY += 1;
    }

    if (model.minZ === model.maxZ) {
        model.minZ -= 1;
        model.maxZ += 1;
    }

    sliceZ = (model.minZ + model.maxZ) * 0.5;

    player.x = (model.minX + model.maxX) * 0.5;
    player.y = (model.minY + model.maxY) * 0.5;
    player.z = sliceZ;
    player.vx = 0;
    player.vy = 0;
    grounded = false;

    // Spawn-tagged geometry is the authoritative spawn.
    const taggedSpawn = findSpawnTaggedPosition();

    if (taggedSpawn) {
        player.x = taggedSpawn.x;
        player.y =
            taggedSpawn.y +
            PLAYER_HEIGHT +
            0.05;
        player.z = taggedSpawn.z;
        sliceZ = player.z;
    } else {
        const spawn =
            findSpawnSurface(
                player.x,
                player.y
            );

        if (spawn !== null) {
            player.y = spawn;
            grounded = true;
        }
    }

    const scale = Math.max(
        model.maxX - model.minX,
        model.maxY - model.minY
    );

    zoom =
        Math.min(width,height) *
        0.72 /
        Math.max(scale,0.001);

    rebuildSlice();
    render();
}