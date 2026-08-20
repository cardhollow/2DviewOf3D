function interpolateEdge(a,b,z) {
    const dz = b.z - a.z;

    if (Math.abs(dz) < 0.000000001) {
        return {
            x: (a.x + b.x) * 0.5,
            y: (a.y + b.y) * 0.5
        };
    }

    const t = (z - a.z) / dz;

    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}function addUniquePoint(points,point) {
    for (const existing of points) {
        const dx = existing.x - point.x;
        const dy = existing.y - point.y;

        if (dx * dx + dy * dy < 0.000000001) {
            return;
        }
    }

    points.push(point);
}function triangleSliceSegment(triangle) {
    const vertices = [triangle.a,triangle.b,triangle.c];
    const points = [];
    const epsilon = Math.max(0.0000001,(model.maxZ - model.minZ) * 0.00000001);

    for (let i = 0; i < 3; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % 3];

        const da = a.z - sliceZ;
        const db = b.z - sliceZ;

        if (Math.abs(da) <= epsilon && Math.abs(db) <= epsilon) {
            addUniquePoint(points,{x:a.x,y:a.y});
            addUniquePoint(points,{x:b.x,y:b.y});
        } else if ((da < -epsilon && db > epsilon) || (da > epsilon && db < -epsilon)) {
            addUniquePoint(points,interpolateEdge(a,b,sliceZ));
        } else if (Math.abs(da) <= epsilon) {
            addUniquePoint(points,{x:a.x,y:a.y});
        } else if (Math.abs(db) <= epsilon) {
            addUniquePoint(points,{x:b.x,y:b.y});
        }
    }

    if (points.length !== 2) {
        return null;
    }

    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;

    if (dx * dx + dy * dy < 0.000000001) {
        return null;
    }

    return {
        a: points[0],
        b: points[1],
        color: triangle.color
    };
}function rebuildSlice() {
    currentSegments = [];

    if (!model) {
        currentLoops = [];
        return;
    }

    for (const triangle of model.triangles) {
        const segment = triangleSliceSegment(triangle);

        if (segment) {
            currentSegments.push(segment);
        }
    }

    currentLoops = buildLoops(currentSegments);
}function pointKey(point) {
    return Math.round(point.x * 100000) + ":" + Math.round(point.y * 100000);
}function buildLoops(segments) {
    const nodes = new Map();
    const edges = [];

    function getNode(point) {
        const key = pointKey(point);

        if (nodes.has(key)) {
            return nodes.get(key);
        }

        const node = {
            x: point.x,
            y: point.y,
            edges: []
        };

        nodes.set(key,node);
        return node;
    }

    for (const segment of segments) {
        const a = getNode(segment.a);
        const b = getNode(segment.b);

        if (a === b) {
            continue;
        }

        const edge = {
            a: a,
            b: b,
            color: segment.color,
            used: false
        };

        edges.push(edge);
        a.edges.push(edge);
        b.edges.push(edge);
    }

    const loops = [];

    for (const edge of edges) {
        if (edge.used) {
            continue;
        }

        const points = [];
        let currentEdge = edge;
        let currentNode = edge.a;

        while (currentEdge && !currentEdge.used && points.length < edges.length + 10) {
            currentEdge.used = true;

            points.push({
                x: currentNode.x,
                y: currentNode.y
            });

            const nextNode = currentEdge.a === currentNode ? currentEdge.b : currentEdge.a;
            let nextEdge = null;

            for (const candidate of nextNode.edges) {
                if (!candidate.used) {
                    nextEdge = candidate;
                    break;
                }
            }

            currentNode = nextNode;
            currentEdge = nextEdge;

            if (currentNode === edge.a) {
                break;
            }
        }

        if (points.length >= 3) {
            const first = points[0];
            const last = points[points.length - 1];

            if (Math.abs(first.x - last.x) < 0.000001 && Math.abs(first.y - last.y) < 0.000001) {
                points.pop();
            }

            if (points.length >= 3) {
                loops.push({
                    points: points,
                    color: edge.color
                });
            }
        }
    }

    return loops;
}function polygonArea(points) {
    let area = 0;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a.x * b.y - b.x * a.y;
    }

    return area * 0.5;
}function pointInPolygon(x,y,points) {
    let inside = false;

    for (let i = 0,j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;

        const intersect = ((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / ((yj - yi) || 0.000000001) + xi;

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
}