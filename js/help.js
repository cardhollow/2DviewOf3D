function helpMenu() {
    const modal = document.getElementById("helpModal");

    modal.innerHTML = `
        <div class="help-modal-box">
            <button class="help-modal-close" id="helpModalClose">X</button>
            <div class="help-modal-content">
    <h2>2D View of 3D</h2>

    <p>
        <strong>2D View of 3D</strong> is a platforming game where you explore a
        three-dimensional world while controlling a creature that can only
        experience the world from a 2D perspective.
    </p>

    <h3>🎮 Objective</h3>

    <p>
        Your goal is simple: <strong>find the exit</strong>.
        Explore the level, navigate around obstacles, and reach the geometry
        marked as the <strong>exit</strong>. Once you reach it, the next level
        will be loaded.
    </p>

    <p>
        Every level becomes progressively more challenging. Later levels may
        require more careful movement, positioning, and understanding of the
        3D environment.
    </p>

    <h3>🌎 The World</h3>

    <p>
        Although the world itself is 3D, you interact with it as a 2D creature.
        This creates situations where the world may contain depth, objects,
        platforms, and paths that are not immediately obvious from your
        perspective.
    </p>

    <p>
        Pay attention to your surroundings and experiment with your movement.
        Sometimes the correct path may not be the most obvious one.
    </p>

    <h3>🚪 Finding the Exit</h3>

    <p>
        Every playable level must contain two important tagged geometries:
    </p>

    <ul>
        <li><strong>spawn</strong> — determines where the player starts.</li>
        <li><strong>exit</strong> — determines where the player must reach to complete the level.</li>
    </ul>

    <p>
        These tags are essential. Without a <strong>spawn</strong>, the game
        does not know where to place the player. Without an <strong>exit</strong>,
        there is no destination for completing the level.
    </p>

    <h3>🧱 Creating Your Own Levels</h3>

    <p>
        You can create your own levels using the built-in level editor.
    </p>

    <p>
 	   Visit <a href="./editor/"><strong>/editor/</strong></a> to create your own levels.
	</p>

    <p>
        From the editor you can create geometry, position objects, adjust
        properties, add the required tags, and export your finished level as
        an <strong>.rbp</strong> file.
    </p>

    <p>
        Make sure every level you create contains at least:
    </p>

    <ul>
        <li>One geometry tagged <strong>spawn</strong>.</li>
        <li>One geometry tagged <strong>exit</strong>.</li>
    </ul>

    <h3>📁 Level File Naming</h3>

    <p>
        When creating a collection of levels, the files should be numbered in
        order:
    </p>

    <pre>1.rbp
2.rbp
3.rbp
4.rbp
5.rbp</pre>

    <p>
        The numbering determines the order in which the levels are loaded.
        Keep the sequence continuous so the game can progress from one level
        to the next correctly.
    </p>

    <h3>🌐 Loading Your Own Levels From a URL</h3>

    <p>
        You can provide your own level collection through the URL using the
        <strong>levels</strong> parameter.
    </p>

    <pre>?levels=URL</pre>

    <p>
        The URL should point to a folder containing your <strong>.rbp</strong>
        level files.
    </p>

    <p>For example:</p>

    <pre>?levels=https://example.com/my-levels/</pre>

    <p>
        The game can then load the numbered files from that location:
    </p>

    <pre>my-levels/
	1.rbp
	2.rbp
	3.rbp
	4.rbp</pre>

    <p>
        This allows you to host your own level packs and share them with other
        players simply by sharing the URL.
    </p>

    <h3>📥 Import Folder</h3>

    <p>
        You can also use <strong>Import Folder</strong> to load your own levels
        directly from your device.
    </p>

    <p>
        Place your numbered <strong>.rbp</strong> files inside a folder and
        select that folder when using the import option. The game will read
        the levels and make them available for playing.
    </p>

    <h3>🛠️ Level Creation Tips</h3>

    <ul>
        <li>Always include a <strong>spawn</strong> geometry.</li>
        <li>Always include an <strong>exit</strong> geometry.</li>
        <li>Test your level from the player's starting position.</li>
        <li>Make sure the exit can actually be reached.</li>
        <li>Number your levels starting from <strong>1.rbp</strong>.</li>
        <li>Keep the numbering continuous.</li>
        <li>Test difficult sections before publishing your level pack.</li>
    </ul>

    <h3>📦 Level Packs</h3>

    <p>
        A level pack is simply a folder containing multiple numbered
        <strong>.rbp</strong> files. You can keep your own collection locally
        or host it online and provide its folder URL through the
        <strong>?levels=</strong> parameter.
    </p>

    <h3>💡 Remember</h3>

    <p>
        You are navigating a 3D world from a 2D perspective. Don't assume
        that everything you see tells the whole story. Explore, experiment,
        and learn how the environment behaves.
    </p>

    <p>
        <strong>Find the exit. Reach the next level. Keep going.</strong>
    </p>
</div>
        </div>
    `;

    modal.style.display = "flex";

    document.getElementById("helpModalClose").addEventListener("click", function() {
        modal.style.display = "none";
        modal.innerHTML = "";
    });

    modal.addEventListener("click", function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
            modal.innerHTML = "";
        }
    });
}