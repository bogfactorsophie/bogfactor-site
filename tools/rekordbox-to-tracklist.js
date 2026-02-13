/**
 * Parses a Rekordbox playlist export file (tab-separated) and returns
 * an array of "Track Title - Artist" strings.
 *
 * Rekordbox exports are tab-delimited with columns:
 *   #, Artwork, Track Title, Artist, ...
 * The first line is a header row starting with #.
 */
(function () {
    function parseRekordboxText(text) {
        var lines = text.split(/\r?\n/);
        var tracklist = [];

        // Skip header row (index 0)
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var fields = line.split('\t');
            if (fields.length >= 4) {
                var trackTitle = fields[2].trim();
                var artist = fields[3].trim();
                if (trackTitle && artist) {
                    tracklist.push(trackTitle + ' - ' + artist);
                }
            }
        }

        return tracklist;
    }

    /**
     * Attach to a file input element. When a file is selected, parse it
     * and call the callback with the resulting tracklist array.
     */
    function attachRekordboxInput(fileInputEl, callback) {
        fileInputEl.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;

            var reader = new FileReader();
            reader.onload = function (event) {
                var text = event.target.result;
                var tracklist = parseRekordboxText(text);
                callback(tracklist);
            };
            // Rekordbox exports can be UTF-16LE; try reading as UTF-8 first,
            // but the browser's FileReader handles BOM-marked UTF-16 automatically.
            reader.readAsText(file);
        });
    }

    window.rekordboxToTracklist = {
        parse: parseRekordboxText,
        attach: attachRekordboxInput,
    };
})();
