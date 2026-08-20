function onKeyDown(event) {
    var target = event.target;

    if (target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
    )) {
        return;
    }

    var key = event.key.toLowerCase();

    if (event.ctrlKey && key === "z") {
        event.preventDefault();
        undo();
        return;
    }

    if (event.ctrlKey && key === "y") {
        event.preventDefault();
        redo();
        return;
    }

    if (event.ctrlKey && key === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();

        var allObjects = getEditorObjects();
        setSelectedObjects(
            allObjects,
            allObjects.length ? allObjects[allObjects.length - 1] : null
        );
        selectionAnchor = allObjects.length ? allObjects[0] : null;
        return;
    }

    if (
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "w" ||
        key === "a" ||
        key === "s" ||
        key === "d"
    ) {
        cameraKeys[key] = true;
        event.preventDefault();
    }

    switch (key) {
        case "q":
            rotateCamera(-0.04);
            break;

        case "e":
            setMode("rotate");
            break;

        case "r":
            setMode("scale");
            break;

        case "w":
            if (!event.ctrlKey) {
                setMode("translate");
            }
            break;

        case "delete":
        case "backspace":
            event.preventDefault();
            deleteSelected();
            break;

        case "escape":
            clearSelection();
            closeMenus();
            break;
    }
}function onKeyUp(event) {
    var key = event.key.toLowerCase();
    cameraKeys[key] = false;
}function rotateCamera(amount) {
    var direction = new THREE.Vector3();

    camera.getWorldDirection(direction);

    var angle = Math.atan2(direction.x, direction.z);
    angle += amount;

    var distance = camera.position.distanceTo(cameraTarget);

    camera.position.x = cameraTarget.x + Math.sin(angle) * distance;
    camera.position.z = cameraTarget.z + Math.cos(angle) * distance;

    camera.lookAt(cameraTarget);
}function updateCameraKeyboard() {
    if (transformDragging || transformControls.dragging) {
        return;
    }

    var forward = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;

    if (forward.lengthSq() > 0) {
        forward.normalize();
    }

    var right = new THREE.Vector3();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    if (right.lengthSq() > 0) {
        right.normalize();
    }

    var movement = new THREE.Vector3();

    if (cameraKeys["arrowup"] || cameraKeys["w"]) {
        movement.add(forward);
    }

    if (cameraKeys["arrowdown"] || cameraKeys["s"]) {
        movement.sub(forward);
    }

    if (cameraKeys["arrowleft"] || cameraKeys["a"]) {
        movement.sub(right);
    }

    if (cameraKeys["arrowright"] || cameraKeys["d"]) {
        movement.add(right);
    }

    if (movement.lengthSq() > 0) {
        movement.normalize();
        movement.multiplyScalar(cameraMoveSpeed);
        camera.position.add(movement);
        cameraTarget.add(movement);
    }
}function setupMobileCamera() {
    setupCameraButton("camUp", "arrowup");
    setupCameraButton("camDown", "arrowdown");
    setupCameraButton("camLeft", "arrowleft");
    setupCameraButton("camRight", "arrowright");
    setupCameraButton("camForward", "w");
}function setupCameraButton(id, key) {
    var button = document.getElementById(id);

    if (!button) {
        return;
    }

    button.addEventListener("pointerdown", function(event) {
        event.preventDefault();
        event.stopPropagation();
        cameraKeys[key] = true;

        try {
            button.setPointerCapture(event.pointerId);
        } catch(error) {}
    }, false);

    button.addEventListener("pointerup", function(event) {
        event.preventDefault();
        event.stopPropagation();
        cameraKeys[key] = false;
    }, false);

    button.addEventListener("pointercancel", function(event) {
        event.stopPropagation();
        cameraKeys[key] = false;
    }, false);

    button.addEventListener("pointerleave", function(event) {
        if (!button.hasPointerCapture || !button.hasPointerCapture(event.pointerId)) {
            cameraKeys[key] = false;
        }
    }, false);
}function onResize() {
    var width = viewport.clientWidth;
    var height = viewport.clientHeight;

    if (width <= 0 || height <= 0) {
        return;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}function animate() {
    requestAnimationFrame(animate);
    updateCameraKeyboard();
    renderer.render(scene, camera);
}