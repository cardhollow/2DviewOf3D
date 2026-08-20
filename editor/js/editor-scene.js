function setupExportMenu() {
    if (!exportMenu || !exportButton || !exportOptions) {
        return;
    }

    exportButton.addEventListener("click", function(event) {
        event.preventDefault();
        event.stopPropagation();

        if (exportMenu.classList.contains("open")) {
            closeMenus();
            return;
        }

        var rect = exportButton.getBoundingClientRect();
        var left = rect.left;
        var top = rect.bottom + 4;
        var width = 190;

        if (left + width > window.innerWidth) {
            left = window.innerWidth - width - 8;
        }

        if (left < 8) {
            left = 8;
        }

        exportOptions.style.left = left + "px";
        exportOptions.style.top = top + "px";
        exportMenu.classList.add("open");
    }, false);

    exportOptions.addEventListener("click", function(event) {
        event.stopPropagation();
    }, false);

    document.addEventListener("click", function(event) {
        if (!exportMenu.contains(event.target)) {
            closeMenus();
        }
    }, false);

    document.addEventListener("pointerdown", function(event) {
        if (!exportMenu.contains(event.target)) {
            closeMenus();
        }
    }, false);
}function closeMenus() {
    if (!exportMenu) {
        return;
    }

    exportMenu.classList.remove("open");
}function createLighting() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 200;

    scene.add(directionalLight);
}function createGrid() {
    grid = new THREE.GridHelper(100, 100, 0x666666, 0x333333);
    grid.position.y = 0;
    scene.add(grid);

    if (THREE.AxisHelper) {
        axes = new THREE.AxisHelper(3);
        scene.add(axes);
    }
}function createGround() {
    var geometry = new THREE.PlaneGeometry(100, 100);
    var material = new THREE.MeshStandardMaterial({
        color: 0x303030,
        roughness: 1,
        metalness: 0
    });

    var ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    ground.name = "__EDITOR_GROUND__";
    ground.userData.editorGround = true;

    scene.add(ground);
}function createTransformControls() {
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.setMode("translate");

    transformControls.addEventListener("change", function() {
        if (selected) {
            updateSelectedObjectMatrices();
            updateInspector();
            updateObjectsList();
        }
    });

    transformControls.addEventListener("dragging-changed", function(event) {
        transformDragging = event.value;
        controls.enabled = !event.value;

        if (event.value) {
            pointerSelecting = false;
            transformHistoryState = serializeScene();
        } else if (transformHistoryState) {
            finishTransformHistory();
        }
    });

    transformControls.addEventListener("mouseDown", function() {
        transformDragging = true;
        controls.enabled = false;
        pointerSelecting = false;

        if (selected) {
            transformHistoryState = serializeScene();
        }
    });

    transformControls.addEventListener("mouseUp", function() {
        transformDragging = false;
        controls.enabled = true;
        finishTransformHistory();
    });

    scene.add(transformControls);
}function finishTransformHistory() {
    if (!transformHistoryState || isRestoringHistory) {
        transformHistoryState = null;
        return;
    }

    var currentState = serializeScene();

    if (JSON.stringify(transformHistoryState) !== JSON.stringify(currentState)) {
        undoStack.push(transformHistoryState);
        redoStack.length = 0;
        saveLocal();
    }

    transformHistoryState = null;
}function createMaterial(color) {
    return new THREE.MeshStandardMaterial({
        color: color === undefined ? 0xffffff : color,
        roughness: 0.8,
        metalness: 0,
        side: THREE.FrontSide
    });
}function createGeometry(type) {
    switch (type) {
        case "sphere":
            return new THREE.SphereGeometry(0.75, 24, 16);

        case "cylinder":
            return new THREE.CylinderGeometry(0.7, 0.7, 1.5, 24);

        case "plane":
            return new THREE.BoxGeometry(2, 0.15, 2);

        case "cone":
            return new THREE.ConeGeometry(0.75, 1.5, 24);

        case "torus":
            return new THREE.TorusGeometry(0.7, 0.2, 12, 24);

        case "box":
        default:
            return new THREE.BoxGeometry(1, 1, 1);
    }
}function addObject(type, position, recordHistory) {
    var geometry = createGeometry(type);
    var material = createMaterial(randomColor());
    var mesh = new THREE.Mesh(geometry, material);

    objectCounter++;

    mesh.name = type.charAt(0).toUpperCase() + type.slice(1) + "_" + objectCounter;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = type;
    mesh.userData.editorObject = true;
    mesh.userData.tags = [];

    if (position) {
        mesh.position.copy(position);
    } else if (selected) {
        mesh.position.copy(selected.position);
        mesh.position.x += 2;
    } else {
        mesh.position.set(0, 0.5, 0);
    }

    scene.add(mesh);
    selectObject(mesh);
    updateObjectsList();

    if (recordHistory !== false) {
        recordModification();
    }

    return mesh;
}function addBox() {
    return addObject("box");
}function addSphere() {
    return addObject("sphere");
}function addCylinder() {
    return addObject("cylinder");
}function addPlane() {
    return addObject("plane");
}function addCone() {
    return addObject("cone");
}function addTorus() {
    return addObject("torus");
}function randomColor() {
    var colors = [
        0xffffff,
        0xff5555,
        0x55ff55,
        0x5555ff,
        0xffff55,
        0xff55ff,
        0x55ffff,
        0xff9955
    ];

    return colors[Math.floor(Math.random() * colors.length)];
}