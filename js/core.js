function createKeySettings() {
    const menu = document.getElementById("settingsmenu");

    menu.innerHTML = "";

    for (const action in keyNames) {
        const button = document.createElement("button");

        button.textContent =
            `${keyNames[action]}: ${formatKey(useKeyMap[action])}`;

        button.addEventListener("click", () => {
            button.textContent =
                `${keyNames[action]}: Press a key...`;

            waitForKey(action, button);
        });

        menu.appendChild(button);
    }

    const back = document.createElement("button");
    back.textContent = "Back";
    back.addEventListener("click", closeSettings);

    menu.appendChild(back);
}function closeSettings() {
    settingsMenu.style.display = "none";
    mainmenu.style.display = "flex";
}function formatKey(key) {
    if (key === " ") {
        return "Space";
    }

    return key.toUpperCase();
}function waitForKey(action, button) {
    function handleKey(event) {
        event.preventDefault();

        const key = event.key.toLowerCase();

        for (const otherAction in useKeyMap) {
            if (
                otherAction !== action &&
                useKeyMap[otherAction] === key
            ) {
                button.textContent =
                    `${keyNames[action]}: Already used`;

                setTimeout(() => {
                    button.textContent =
                        `${keyNames[action]}: ${formatKey(useKeyMap[action])}`;
                }, 1000);

                window.removeEventListener("keydown", handleKey);
                return;
            }
        }

        useKeyMap[action] = key;

        button.textContent =
            `${keyNames[action]}: ${formatKey(key)}`;

        window.removeEventListener("keydown", handleKey);
    }

    window.addEventListener("keydown", handleKey);
}function resizeCanvas() {
    if (gameElement.style.display === "none") {
        return;
    }

    width = Math.max(1,window.innerWidth);
    height = Math.max(1,window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1,2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    render();
}function clamp(value,min,max) {
    return Math.max(min,Math.min(max,value));
}function formatNumber(value) {
    return value.toFixed(3).replace(/0+$/,"").replace(/\.$/,"");
}