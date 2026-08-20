function project(point) {
    const centerX = (model.minX + model.maxX) * 0.5;
    const centerY = (model.minY + model.maxY) * 0.5;

    return {
        x: width * 0.5 + (point.x - centerX) * zoom,
        y: height * 0.5 - (point.y - centerY) * zoom
    };
}function drawSlices() {
    for (const segment of currentSegments) {
        const a = project(segment.a);
        const b = project(segment.b);

        ctx.beginPath();
        ctx.moveTo(a.x,a.y);
        ctx.lineTo(b.x,b.y);
        ctx.strokeStyle = "#" + (segment.color || 0xffffff).toString(16).padStart(6,"0");
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}function drawPlayer() {
    const halfWidth = PLAYER_WIDTH * 0.5;
    const left = player.x - halfWidth;
    const right = player.x + halfWidth;
    const bottom = player.y;
    const top = player.y + PLAYER_HEIGHT;

    const p1 = project({x:left,y:bottom});
    const p2 = project({x:right,y:top});

    ctx.fillStyle = "#fff";
    ctx.fillRect(p1.x,p2.y,p2.x - p1.x,p1.y - p2.y);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(p1.x,p2.y,p2.x - p1.x,p1.y - p2.y);
}function render() {
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);

    ctx.fillStyle = "#202020";
    ctx.fillRect(0,0,width,height);

    if (!model) {
        return;
    }

    drawSlices();
    drawPlayer();

    zInfo.textContent = "Z: " + formatNumber(player.z);
}function animate(time) {
    requestAnimationFrame(animate);

    if (!lastTime) {
        lastTime = time;
    }

    let dt = (time - lastTime) / 1000;
    lastTime = time;
    dt = Math.min(dt,0.033);

    if (gameElement.style.display !== "none" && model) {
        updatePlayer(dt);
        render();
    }
}