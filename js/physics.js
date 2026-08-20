function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase();
}function getTagTriangles(tag) {
    const wanted = normalizeTag(tag);

    if (!wanted || !model || !model.tagGroups) {
        return [];
    }

    return model.tagGroups[wanted] || [];
}function pointInsideTaggedTriangle(x,y,z,triangle) {
    if (!triangle) {
        return false;
    }

    const zMin = Math.min(
        triangle.a.z,
        triangle.b.z,
        triangle.c.z
    );

    const zMax = Math.max(
        triangle.a.z,
        triangle.b.z,
        triangle.c.z
    );

    if (
        z < zMin - COLLISION_EPSILON ||
        z > zMax + COLLISION_EPSILON
    ) {
        return false;
    }

    return pointInPolygon(
        x,
        y,
        [
            {x:triangle.a.x,y:triangle.a.y},
            {x:triangle.b.x,y:triangle.b.y},
            {x:triangle.c.x,y:triangle.c.y}
        ]
    );
}function findSpawnTaggedPosition() {
    const triangles = getTagTriangles("spawn");

    if (!triangles.length) {
        return null;
    }

    const bounds = {
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
            bounds.minX = Math.min(bounds.minX,point.x);
            bounds.maxX = Math.max(bounds.maxX,point.x);
            bounds.minY = Math.min(bounds.minY,point.y);
            bounds.maxY = Math.max(bounds.maxY,point.y);
            bounds.minZ = Math.min(bounds.minZ,point.z);
            bounds.maxZ = Math.max(bounds.maxZ,point.z);
        }
    }

    return {
        x: (bounds.minX + bounds.maxX) * 0.5,
        y: bounds.maxY,
        z: (bounds.minZ + bounds.maxZ) * 0.5
    };
}function playerTouchesExit() {
    const exits = getTagTriangles("exit");

    if (!exits.length) {
        return false;
    }

    const halfWidth = PLAYER_WIDTH * 0.5;
    const halfDepth = PLAYER_DEPTH * 0.5;

    const playerMinX = player.x - halfWidth;
    const playerMaxX = player.x + halfWidth;
    const playerMinY = player.y;
    const playerMaxY = player.y + PLAYER_HEIGHT;
    const playerMinZ = player.z - halfDepth;
    const playerMaxZ = player.z + halfDepth;

    function rangesOverlap(aMin,aMax,bMin,bMax,epsilon) {
        return (
            aMax >= bMin - epsilon &&
            aMin <= bMax + epsilon
        );
    }

    for (const triangle of exits) {
        const triMinX = Math.min(
            triangle.a.x,
            triangle.b.x,
            triangle.c.x
        );

        const triMaxX = Math.max(
            triangle.a.x,
            triangle.b.x,
            triangle.c.x
        );

        const triMinY = Math.min(
            triangle.a.y,
            triangle.b.y,
            triangle.c.y
        );

        const triMaxY = Math.max(
            triangle.a.y,
            triangle.b.y,
            triangle.c.y
        );

        const triMinZ = Math.min(
            triangle.a.z,
            triangle.b.z,
            triangle.c.z
        );

        const triMaxZ = Math.max(
            triangle.a.z,
            triangle.b.z,
            triangle.c.z
        );

        if (!rangesOverlap(
            playerMinX,
            playerMaxX,
            triMinX,
            triMaxX,
            PLAYER_WIDTH * 0.15 + COLLISION_EPSILON
        )) {
            continue;
        }

        if (!rangesOverlap(
            playerMinY,
            playerMaxY,
            triMinY,
            triMaxY,
            PLAYER_HEIGHT * 0.15 + COLLISION_EPSILON
        )) {
            continue;
        }

        if (!rangesOverlap(
            playerMinZ,
            playerMaxZ,
            triMinZ,
            triMaxZ,
            halfDepth + COLLISION_EPSILON
        )) {
            continue;
        }

        // Bounding-box overlap is the primary trigger. For a normal
        // horizontal Exit, also accept the player's center against the
        // projected triangle to make the trigger precise.
        if (
            pointInsideTaggedTriangle(
                player.x,
                player.y,
                player.z,
                triangle
            )
        ) {
            return true;
        }

        // For vertical/slanted Exit surfaces, the 3D bounds are sufficient.
        return true;
    }

    return false;
}function pointInsideSlice(x,y) {
    for (const loop of currentLoops) {
        if (pointInPolygon(x,y,loop.points)) {
            return true;
        }
    }

    return false;
}function horizontalIntersections(y) {
    const hits = [];

    for (const segment of currentSegments) {
        const a = segment.a;
        const b = segment.b;

        if ((a.y > y) === (b.y > y)) {
            continue;
        }

        const t = (y - a.y) / (b.y - a.y);

        if (t < 0 || t > 1) {
            continue;
        }

        hits.push({
            x: a.x + (b.x - a.x) * t,
            segment: segment
        });
    }

    hits.sort(function(a,b) {
        return a.x - b.x;
    });

    return hits;
}function supportY(x) {
    let best = null;

    const hits = [];

    for (const segment of currentSegments) {
        const a = segment.a;
        const b = segment.b;

        if (x < Math.min(a.x,b.x) - COLLISION_EPSILON || x > Math.max(a.x,b.x) + COLLISION_EPSILON) {
            continue;
        }

        if (Math.abs(b.x - a.x) < 0.000001) {
            hits.push({
                y: Math.max(a.y,b.y),
                x: x
            });
            continue;
        }

        const t = (x - a.x) / (b.x - a.x);

        if (t < -COLLISION_EPSILON || t > 1 + COLLISION_EPSILON) {
            continue;
        }

        hits.push({
            y: a.y + (b.y - a.y) * t,
            x: x
        });
    }

    for (const hit of hits) {
        if (hit.y <= player.y + COLLISION_EPSILON) {
            if (best === null || hit.y > best) {
                best = hit.y;
            }
        }
    }

    return best;
}function findSpawnSurface(x,y) {
    const candidates = [];
    const samples = [
        x,
        x - PLAYER_WIDTH * 0.45,
        x + PLAYER_WIDTH * 0.45
    ];

    for (const sample of samples) {
        const surface = supportY(sample);

        if (surface !== null) {
            candidates.push(surface);
        }
    }

    if (!candidates.length) {
        return null;
    }

    return Math.max(...candidates);
}function playerOverlapsSolid(x,y) {
    const halfWidth = PLAYER_WIDTH * 0.5;
    const bottom = y;
    const top = y + PLAYER_HEIGHT;

    const samples = [
        [x - halfWidth,bottom],
        [x + halfWidth,bottom],
        [x - halfWidth,top],
        [x + halfWidth,top],
        [x,bottom],
        [x,top],
        [x - halfWidth,bottom + PLAYER_HEIGHT * 0.5],
        [x + halfWidth,bottom + PLAYER_HEIGHT * 0.5]
    ];

    for (const sample of samples) {
        if (pointInsideSlice(sample[0],sample[1])) {
            return true;
        }
    }

    return false;
}function moveHorizontal(dx) {
    if (dx === 0) {
        return;
    }

    const steps = Math.max(1,Math.ceil(Math.abs(dx) / 0.05));
    const amount = dx / steps;

    for (let i = 0; i < steps; i++) {
        const nextX = player.x + amount;

        if (!playerOverlapsSolid(nextX,player.y)) {
            player.x = nextX;
            continue;
        }

        const stepHeight = 0.35;
        let stepped = false;

        for (let s = 0.05; s <= stepHeight; s += 0.05) {
            const testY = player.y + s;

            if (!playerOverlapsSolid(nextX,testY)) {
                player.x = nextX;
                player.y = testY;
                stepped = true;
                break;
            }
        }

        if (!stepped) {
            player.vx = 0;
            break;
        }
    }
}function moveVertical(dy) {
    if (dy === 0) {
        return;
    }

    const steps = Math.max(1,Math.ceil(Math.abs(dy) / 0.04));
    const amount = dy / steps;

    for (let i = 0; i < steps; i++) {
        const nextY = player.y + amount;

        if (!playerOverlapsSolid(player.x,nextY)) {
            player.y = nextY;
            continue;
        }

        if (amount < 0) {
            const surface = findSpawnSurface(player.x,player.y);

            if (surface !== null && surface <= player.y + 0.08) {
                player.y = surface;
                grounded = true;
            }
        }

        player.vy = 0;
        return;
    }

    grounded = false;
}function updatePlayer(dt) {
    if (!model) {
        return;
    }

    let horizontal = 0;
    let depth = 0;

    if (keys[useKeyMap.left]) {
        horizontal -= 1;
    }

    if (keys[useKeyMap.right]) {
        horizontal += 1;
    }

    if (keys[useKeyMap.forward]) {
        depth += 1;
    }

    if (keys[useKeyMap.backward]) {
        depth -= 1;
    }

    player.vx = horizontal * MOVE_SPEED;

    if (keys[useKeyMap.jump] && grounded) {
        player.vy = JUMP_SPEED;
        grounded = false;
    }

    moveHorizontal(player.vx * dt);

    player.vy -= GRAVITY * dt;
    moveVertical(player.vy * dt);

    if (depth !== 0) {
        player.z += depth * Z_SPEED * dt;
        player.z = clamp(player.z, model.minZ, model.maxZ);
        sliceZ = player.z;
        rebuildSlice();
    }

    const surface = findSpawnSurface(player.x, player.y);

    if (
        surface !== null &&
        Math.abs(player.y - surface) < 0.06 &&
        player.vy <= 0
    ) {
        player.y = surface;
        player.vy = 0;
        grounded = true;
    }

    if (player.y < model.minY - 20) {
        const taggedSpawn = findSpawnTaggedPosition();

        if (taggedSpawn) {
            player.x = taggedSpawn.x;
            player.y = taggedSpawn.y + PLAYER_HEIGHT + 0.05;
            player.z = taggedSpawn.z;
            sliceZ = player.z;
            rebuildSlice();
        } else {
            player.x = (model.minX + model.maxX) * 0.5;
            player.y = model.maxY + 2;
        }

        player.vy = 0;
        grounded = false;
    }

    if (playerTouchesExit()) {
        goToNextLevel();
    }
}