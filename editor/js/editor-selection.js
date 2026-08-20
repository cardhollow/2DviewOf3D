function isObjectSelected(object) {
    return selectedObjects.indexOf(object) !== -1;
}function setSelectedObjects(objects, primary) {
    var unique = [];
    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
        if (object && object.userData && object.userData.editorObject &&
            unique.indexOf(object) === -1) {
            unique.push(object);
        }
    }
    selectedObjects = unique;

    if (selectedObjects.length) {
        selected = primary && isObjectSelected(primary)
            ? primary
            : selectedObjects[selectedObjects.length - 1];
        transformControls.attach(selected);
    } else {
        selected = null;
        transformControls.detach();
    }

    updateInspector();
    updateObjectsList();

    statusElement.textContent =
        selectedObjects.length === 0 ? "Ready" :
        selectedObjects.length === 1 ? "Selected: " + selectedObjects[0].name :
        selectedObjects.length + " objects selected";
}function selectObjectRange(anchor, target, additive) {
    var objects = getEditorObjects();
    var anchorIndex = objects.indexOf(anchor);
    var targetIndex = objects.indexOf(target);

    if (anchorIndex < 0 || targetIndex < 0) {
        setSelectedObjects(additive ? selectedObjects.concat([target]) : [target], target);
        return;
    }

    var start = Math.min(anchorIndex, targetIndex);
    var end = Math.max(anchorIndex, targetIndex);
    var range = objects.slice(start, end + 1);

    setSelectedObjects(
        additive ? selectedObjects.concat(range) : range,
        target
    );
}function selectObjectWithModifiers(object, event) {
    if (!object) return;

    var additive = !!(event && (event.ctrlKey || event.metaKey));
    var range = !!(event && event.shiftKey);

    if (range && selectionAnchor) {
        selectObjectRange(selectionAnchor, object, additive);
        return;
    }

    if (additive) {
        if (isObjectSelected(object)) {
            var remaining = selectedObjects.filter(function(item) {
                return item !== object;
            });
            setSelectedObjects(
                remaining,
                remaining.length ? remaining[remaining.length - 1] : null
            );
        } else {
            setSelectedObjects(selectedObjects.concat([object]), object);
        }
        selectionAnchor = object;
        return;
    }

    setSelectedObjects([object], object);
    selectionAnchor = object;
}function updateSelectedObjectMatrices() {
    for (var i = 0; i < selectedObjects.length; i++) {
        var object = selectedObjects[i];
        if (!object) continue;

        object.updateMatrix();
        object.updateMatrixWorld(true);

        if (object.geometry) {
            if (typeof object.geometry.computeBoundingSphere === "function") {
                object.geometry.computeBoundingSphere();
            }
            if (typeof object.geometry.computeBoundingBox === "function") {
                object.geometry.computeBoundingBox();
            }
        }
    }

    renderer.render(scene, camera);
}function getCommonValue(objects, getter) {
    if (!objects.length) return null;

    var first = getter(objects[0]);
    for (var i = 1; i < objects.length; i++) {
        if (getter(objects[i]) !== first) return null;
    }
    return first;
}function selectObject(object) {
    if (!object || !object.userData || !object.userData.editorObject) return;
    setSelectedObjects([object], object);
    selectionAnchor = object;
}function clearSelection() {
    selectedObjects = [];
    selected = null;
    selectionAnchor = null;
    transformControls.detach();
    updateInspector();
    updateObjectsList();
    statusElement.textContent = "Ready";
}function isPointerOnTransformGizmo(event) {
    if (!selected || !transformControls || !transformControls.visible) {
        return false;
    }

    var rect = renderer.domElement.getBoundingClientRect();
    var x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    var y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    var gizmoRaycaster = new THREE.Raycaster();

    gizmoRaycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    var hits = gizmoRaycaster.intersectObjects(transformControls.children, true);

    return hits.length > 0;
}function isPointerOnMobileControl(event) {
    var element = event.target;

    if (!element) {
        return false;
    }

    return element.classList && element.classList.contains("mobile-button");
}function onPointerDown(event) {
    if (isPointerOnMobileControl(event)) return;
    if (event.target !== renderer.domElement) return;
    if (transformDragging || transformControls.dragging) return;

    pointerSelecting = true;

    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    var hits = raycaster.intersectObjects(getEditorObjects(), true);

    if (hits.length > 0) {
        var object = hits[0].object;

        while (object.parent &&
            !(object.userData && object.userData.editorObject)) {
            object = object.parent;
        }

        if (object.userData && object.userData.editorObject) {
            selectObjectWithModifiers(object, event);
            return;
        }
    }

    // Clicking empty viewport/background does NOT deselect.
    // Selection changes only when an editor object is actually clicked,
    // or through explicit commands such as Deselect / Escape.
}function onPointerMove(event) {
    if (isPointerOnMobileControl(event)) {
        return;
    }

    if (transformDragging || transformControls.dragging) {
        controls.enabled = false;
        return;
    }

    controls.enabled = true;
}function onPointerUp(event) {
    if (isPointerOnMobileControl(event)) {
        return;
    }

    pointerSelecting = false;

    if (transformDragging || transformControls.dragging) {
        controls.enabled = false;
        return;
    }

    controls.enabled = true;
}function getEditorObjects() {
    var result = [];

    scene.traverse(function(object) {
        if (object.userData && object.userData.editorObject) {
            result.push(object);
        }
    });

    return result;
}function updateObjectsList() {
    objectsElement.innerHTML = "";
    var objects = getEditorObjects();

    for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
        var item = document.createElement("div");

        item.className = "object-item";
        if (isObjectSelected(object)) item.className += " selected";

        item.textContent = object.name;
        item.onclick = (function(obj) {
            return function(event) {
                selectObjectWithModifiers(obj, event);
            };
        })(object);

        objectsElement.appendChild(item);
    }
}function updateInspector() {
    var nameInput = document.getElementById("nameInput");
    var tagsInput = document.getElementById("tagsInput");
    var geometrySelect = document.getElementById("geometrySelect");
    var objectInfo = document.getElementById("objectInfo");

    if (!selectedObjects.length) {
        nameInput.value = "";
        tagsInput.value = "";
        geometrySelect.value = "box";
        objectInfo.textContent = "Nothing selected.";
        return;
    }

    var primary = selected || selectedObjects[selectedObjects.length - 1];

    if (selectedObjects.length > 1) {
        var commonName = getCommonValue(selectedObjects, function(object) {
            return object.name;
        });

        var commonTags = getCommonValue(selectedObjects, function(object) {
            return JSON.stringify(object.userData.tags || []);
        });

        nameInput.value = commonName === null ? "" : commonName;
        tagsInput.value = commonTags === null ? "" : JSON.parse(commonTags).join(", ");

        objectInfo.innerHTML =
            "<b>" + selectedObjects.length + " objects selected</b><br>" +
            "Transform fields use the active object.<br>" +
            "Transform changes apply to all selected objects.";
    } else {
        nameInput.value = primary.name;
        tagsInput.value = (primary.userData.tags || []).join(", ");
        objectInfo.innerHTML =
            "Name: " + primary.name + "<br>" +
            "Type: " + (primary.userData.type || "object") + "<br>" +
            "UUID: " + primary.uuid;
    }

    document.getElementById("px").value = primary.position.x.toFixed(3);
    document.getElementById("py").value = primary.position.y.toFixed(3);
    document.getElementById("pz").value = primary.position.z.toFixed(3);
    document.getElementById("rx").value = THREE.Math.radToDeg(primary.rotation.x).toFixed(2);
    document.getElementById("ry").value = THREE.Math.radToDeg(primary.rotation.y).toFixed(2);
    document.getElementById("rz").value = THREE.Math.radToDeg(primary.rotation.z).toFixed(2);
    document.getElementById("sx").value = primary.scale.x.toFixed(3);
    document.getElementById("sy").value = primary.scale.y.toFixed(3);
    document.getElementById("sz").value = primary.scale.z.toFixed(3);

    if (primary.material && primary.material.color) {
    	let valCol = "#" + primary.material.color.getHexString();
        document.getElementById("colorInput").value =
            valCol;
        document.getElementById("colorText").value =
            valCol;
    }

    geometrySelect.value = primary.userData.type || "box";
}function applyInspector() {
    if (!selectedObjects.length) return;

    var before = inspectorTransformHistoryState || serializeScene();

    var nameValue = document.getElementById("nameInput").value || "Object";
    var tagValues = document.getElementById("tagsInput").value
        .split(",")
        .map(function(tag) { return tag.trim(); })
        .filter(function(tag) { return tag.length > 0; });

    for (var i = 0; i < selectedObjects.length; i++) {
        var object = selectedObjects[i];

        if (selectedObjects.length === 1) {
            object.name = nameValue;
        }

        object.userData.tags = tagValues.slice();

        object.position.set(
            numberValue("px", object.position.x),
            numberValue("py", object.position.y),
            numberValue("pz", object.position.z)
        );

        object.rotation.set(
            THREE.Math.degToRad(numberValue("rx", THREE.Math.radToDeg(object.rotation.x))),
            THREE.Math.degToRad(numberValue("ry", THREE.Math.radToDeg(object.rotation.y))),
            THREE.Math.degToRad(numberValue("rz", THREE.Math.radToDeg(object.rotation.z)))
        );

        object.scale.set(
            numberValue("sx", object.scale.x),
            numberValue("sy", object.scale.y),
            numberValue("sz", object.scale.z)
        );
    }

    inspectorTransformHistoryState = null;
    updateSelectedObjectMatrices();
    updateObjectsList();
    updateInspector();
    recordModification(before);

    statusElement.textContent =
        selectedObjects.length > 1
            ? "Applied to " + selectedObjects.length + " objects"
            : "Transform applied";
}function beginInspectorTransformHistory() {
    if (!isRestoringHistory && !inspectorTransformHistoryState) {
        inspectorTransformHistoryState = serializeScene();
    }
}function applyInspectorTransformsLive() {
    if (!selectedObjects.length) return;

    beginInspectorTransformHistory();

    for (var i = 0; i < selectedObjects.length; i++) {
        var object = selectedObjects[i];

        object.position.set(
            numberValue("px", object.position.x),
            numberValue("py", object.position.y),
            numberValue("pz", object.position.z)
        );

        object.rotation.set(
            THREE.Math.degToRad(numberValue("rx", THREE.Math.radToDeg(object.rotation.x))),
            THREE.Math.degToRad(numberValue("ry", THREE.Math.radToDeg(object.rotation.y))),
            THREE.Math.degToRad(numberValue("rz", THREE.Math.radToDeg(object.rotation.z)))
        );

        object.scale.set(
            numberValue("sx", object.scale.x),
            numberValue("sy", object.scale.y),
            numberValue("sz", object.scale.z)
        );
    }

    updateSelectedObjectMatrices();
}function commitInspectorTransformHistory() {
    if (!inspectorTransformHistoryState) return;

    var before = inspectorTransformHistoryState;
    inspectorTransformHistoryState = null;
    recordModification(before);
}function setupInspectorTransformEvents() {
    var ids = ["px","py","pz","rx","ry","rz","sx","sy","sz"];

    for (var i = 0; i < ids.length; i++) {
        var input = document.getElementById(ids[i]);

        if (!input) continue;

        input.addEventListener("input", function() {
            applyInspectorTransformsLive();
            statusElement.textContent = "Transform updated";
        }, false);

        input.addEventListener("change", function() {
            applyInspectorTransformsLive();
            commitInspectorTransformHistory();
            updateInspector();
        }, false);
    }

    var allInputs = document.querySelectorAll("#right input, #right select");

    for (var j = 0; j < allInputs.length; j++) {
        allInputs[j].addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyInspector();
            }
        }, false);
    }
}function numberValue(id, fallback) {
    var value = parseFloat(document.getElementById(id).value);

    if (isNaN(value)) {
        return fallback;
    }

    return value;
}
function applyColor(source) {
    if (!selectedObjects.length) return;

    var colorInput = document.getElementById("colorInput");
    var colorText = document.getElementById("colorText");

    var value = source === "text"
        ? colorText.value.trim()
        : colorInput.value;

    // Accept #RGB or #RRGGBB
    if (!/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(value)) {
        colorText.reportValidity();
        return;
    }

    var before = serializeScene();

    for (var i = 0; i < selectedObjects.length; i++) {
        var object = selectedObjects[i];

        if (object.material && object.material.color) {
            object.material.color.set(value);
        }
    }

    updateInspector();
    recordModification(before);

    // Keep both controls synchronized
    colorInput.value = value;
    colorText.value = value;
}

function changeGeometry() {
    if (!selectedObjects.length) return;

    var before = serializeScene();
    var type = document.getElementById("geometrySelect").value;

    for (var i = 0; i < selectedObjects.length; i++) {
        var object = selectedObjects[i];
        var oldGeometry = object.geometry;

        object.geometry = createGeometry(type);
        object.userData.type = type;

        if (object.geometry.computeBoundingSphere) {
            object.geometry.computeBoundingSphere();
        }
        if (object.geometry.computeBoundingBox) {
            object.geometry.computeBoundingBox();
        }

        if (oldGeometry) oldGeometry.dispose();
    }

    updateSelectedObjectMatrices();
    updateInspector();
    recordModification(before);
}function duplicateSelected() {
    if (!selectedObjects.length) return;

    var before = serializeScene();
    var clones = [];

    for (var i = 0; i < selectedObjects.length; i++) {
        var source = selectedObjects[i];
        var clone = source.clone();

        clone.name = source.name + "_Copy";
        clone.position.x += 1;
        clone.userData = JSON.parse(JSON.stringify(source.userData));
        clone.userData.editorObject = true;
        clone.material = source.material.clone();
        clone.geometry = source.geometry.clone();

        scene.add(clone);
        objectCounter++;
        clones.push(clone);
    }

    setSelectedObjects(clones, clones[clones.length - 1]);
    selectionAnchor = clones[clones.length - 1];
    recordModification(before);
}function deleteSelected() {
    if (!selectedObjects.length) return;

    var label =
        selectedObjects.length === 1
            ? "\"" + selectedObjects[0].name + "\""
            : selectedObjects.length + " selected objects";

    if (!confirm("Delete " + label + "?")) return;

    var before = serializeScene();
    var toDelete = selectedObjects.slice();

    clearSelection();

    for (var i = 0; i < toDelete.length; i++) {
        var object = toDelete[i];

        scene.remove(object);

        if (object.geometry) object.geometry.dispose();

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

    updateObjectsList();
    recordModification(before);
    statusElement.textContent = "Deleted";
}function setMode(mode) {
    if (!transformControls) {
        return;
    }

    transformControls.setMode(mode);

    document.getElementById("translateButton").classList.remove("active");
    document.getElementById("rotateButton").classList.remove("active");
    document.getElementById("scaleButton").classList.remove("active");

    if (mode === "translate") {
        document.getElementById("translateButton").classList.add("active");
    }

    if (mode === "rotate") {
        document.getElementById("rotateButton").classList.add("active");
    }

    if (mode === "scale") {
        document.getElementById("scaleButton").classList.add("active");
    }

    statusElement.textContent = "Mode: " + mode;
}

document.getElementById("colorInput")
    .addEventListener("change", () => applyColor("picker"));

document.getElementById("colorText")
    .addEventListener("input", () => applyColor("text"));
