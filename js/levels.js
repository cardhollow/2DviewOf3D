let activeLevelFolder = LEVEL_FOLDER;

function createLevelButton(level,bytes) {
    const button = document.createElement("button");

    button.className = "level";
    button.textContent = "Level " + level;

    button.addEventListener("click",function() {
        loadLevel(level,bytes);
    });

    levelsElement.appendChild(button);
}

function createLevelTopBar() {
    const topbar = document.createElement("div");

    topbar.id = "levelTopbar";

    topbar.innerHTML = `
        <div class="level-topbar-title">Levels</div>
        <button id="importFolderButton">Import Folder</button>
    `;

    levelsElement.parentNode.insertBefore(topbar,levelsElement);

    document.getElementById("importFolderButton").addEventListener("click",function() {
        importLevelFolder();
    });
}

async function scanLevels() {
    levelsElement.innerHTML = "";

    mainmenu.style.display = "none";
    settingsMenu.style.display = "none";
    levelsElement.style.display = "grid";
    loading.style.display = "block";

    if (!document.getElementById("levelTopbar")) {
        createLevelTopBar();
    }

    let queryFolder = null;

    try {
        const params = new URLSearchParams(window.location.search);
        queryFolder = params.get("levels");
    } catch (error) {
        console.warn("Could not read levels query:",error);
    }

    let folderToUse = LEVEL_FOLDER;
    let usedQueryFolder = false;

    if (queryFolder) {
        try {
            folderToUse = new URL(queryFolder,window.location.href).href;

            if (!folderToUse.endsWith("/")) {
                folderToUse += "/";
            }

            usedQueryFolder = true;
        } catch (error) {
            console.warn("Invalid levels URL:",queryFolder);
        }
    }

    const result = await loadLevelFolder(folderToUse);

    if (result.success) {
        activeLevelFolder = folderToUse;

        if (usedQueryFolder) {
            console.log("Loaded levels from URL:",folderToUse);
        }

        loading.style.display = "none";
        return;
    }

    if (usedQueryFolder) {
        alert(
            "The custom levels URL could not be loaded.\n\n" +
            "URL:\n" +
            folderToUse +
            "\n\n" +
            "The game will now load the local levels instead."
        );
    }

    levelsElement.innerHTML = "";

    const localResult = await loadLevelFolder(LEVEL_FOLDER);

    if (localResult.success) {
        activeLevelFolder = LEVEL_FOLDER;
    } else {
        const message = document.createElement("div");

        message.className = "level-load-error";
        message.textContent = "No valid levels could be found.";

        levelsElement.appendChild(message);
    }

    loading.style.display = "none";
}

async function loadLevelFolder(folder) {
    let foundAny = false;

    for (let level = 1; level <= MAX_LEVEL_SCAN; level++) {
        try {
            const response = await fetch(
                folder + level + ".rbp",
                {
                    cache:"no-store"
                }
            );

            if (!response.ok) {
                break;
            }

            const bytes = new Uint8Array(
                await response.arrayBuffer()
            );

            if (
                bytes.length < 4 ||
                bytes[0] !== 0x52 ||
                bytes[1] !== 0x42 ||
                bytes[2] !== 0x50
            ) {
                break;
            }

            createLevelButton(level,bytes);
            foundAny = true;
        } catch (error) {
            break;
        }
    }

    return {
        success:foundAny
    };
}

async function importLevelFolder() {
    if (!window.showDirectoryPicker) {
        alert(
            "Folder importing is not supported by this browser."
        );

        return;
    }

    try {
        const directory = await window.showDirectoryPicker();

        const files = [];

        for await (const entry of directory.values()) {
            if (
                entry.kind === "file" &&
                entry.name.toLowerCase().endsWith(".rbp")
            ) {
                files.push(entry);
            }
        }

        files.sort(function(a,b) {
            const aNumber = parseInt(
                a.name.match(/\d+/)?.[0] || "0"
            );

            const bNumber = parseInt(
                b.name.match(/\d+/)?.[0] || "0"
            );

            return aNumber - bNumber;
        });

        levelsElement.innerHTML = "";

        let imported = 0;

        for (let i = 0; i < files.length; i++) {
            const entry = files[i];

            const match = entry.name.match(/^(\d+)\.rbp$/i);

            if (!match) {
                continue;
            }

            const level = parseInt(match[1],10);
            const file = await entry.getFile();
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);

            if (
                bytes.length < 4 ||
                bytes[0] !== 0x52 ||
                bytes[1] !== 0x42 ||
                bytes[2] !== 0x50
            ) {
                continue;
            }

            createLevelButton(level,bytes);
            imported++;
        }

        if (!imported) {
            alert(
                "No valid numbered RBP files were found.\n\n" +
                "Files should be named:\n" +
                "1.rbp\n" +
                "2.rbp\n" +
                "3.rbp\n" +
                "and so on."
            );

            await scanLevels();
            return;
        }

        activeLevelFolder = null;

        console.log(
            "Imported",
            imported,
            "RBP levels."
        );
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);

            alert(
                "Could not import the level folder.\n\n" +
                error.message
            );
        }
    }
}

function goToNextLevel() {
    if (!currentLevel || levelTransitioning) {
        return;
    }

    const nextLevel = currentLevel + 1;

    levelTransitioning = true;
    loading.style.display = "block";

    if (!activeLevelFolder) {
        loading.style.display = "none";
        levelTransitioning = false;

        gameElement.style.display = "none";
        levelsElement.style.display = "grid";

        model = null;
        currentLevel = 0;
        currentSegments = [];
        currentLoops = [];

        return;
    }

    fetch(
        activeLevelFolder + nextLevel + ".rbp",
        {
            cache:"no-store"
        }
    )
        .then(function(response) {
            if (!response.ok) {
                throw new Error(
                    "Level " +
                    nextLevel +
                    " was not found."
                );
            }

            return response.arrayBuffer();
        })
        .then(function(buffer) {
            const bytes = new Uint8Array(buffer);

            if (
                bytes.length < 4 ||
                bytes[0] !== 0x52 ||
                bytes[1] !== 0x42 ||
                bytes[2] !== 0x50
            ) {
                throw new Error(
                    "Level " +
                    nextLevel +
                    " is not an RBP file."
                );
            }

            loadLevel(nextLevel,bytes);

            loading.style.display = "none";
            levelTransitioning = false;
        })
        .catch(function(error) {
            console.warn(
                "Could not advance to next level:",
                error
            );

            loading.style.display = "none";
            levelTransitioning = false;

            gameElement.style.display = "none";
            levelsElement.style.display = "grid";

            model = null;
            currentLevel = 0;
            currentSegments = [];
            currentLoops = [];
        });
}

function loadLevel(level,bytes) {
    loading.style.display = "block";
    levelTransitioning = false;

    try {
        currentLevel = level;
        loadRBP(bytes);

        levelsElement.style.display = "none";
        gameElement.style.display = "block";

        resizeCanvas();
    } catch (error) {
        console.error(error);

        alert(
            "Could not load Level " +
            level +
            ":\n\n" +
            error.message
        );
    }

    loading.style.display = "none";
}

function openSettings() {
    mainmenu.style.display = "none";
    settingsMenu.style.display = "flex";
    createKeySettings();
}