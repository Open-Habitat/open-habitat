// The capability section's intro: tens of thousands of programs, the four
// field-leading claims with their sources (round 5/6 NOTES, "Claims to verify";
// exactly these four, no others) and a wall of programs from the Ubuntu
// archive, grouped like the capability groups under it. The group links are
// drawn by the engine from the caps-* blocks.
import { esc } from '../../engine/kit.mjs';

// A claim of leadership only with its source; the quotation is the source's own sentence.
const LIBRARY = [
  ['FFmpeg', 'Video and sound', '“FFmpeg is the leading multimedia framework”', 'ffmpeg.org', 'https://ffmpeg.org/about.html'],
  ['SQLite', 'Databases', '“SQLite is the most widely deployed database in the world”', 'sqlite.org', 'https://sqlite.org/about.html'],
  ['QGIS', 'Maps', '“QGIS is the leading Free and Open Source Desktop GIS.”', 'osgeo.org', 'https://www.osgeo.org/projects/qgis/'],
  ['Git', 'Version history', '“Git is widely used”', 'git-scm.com', 'https://git-scm.com/about'],
];

// [program as people know it, Ubuntu package]. Every package was checked with
// `apt-cache show --no-all-versions <package>` on Ubuntu 24.04.5 LTS (main and
// universe) on 23 November 2026; NOTES.md has the command and the versions.
// The four sourced programs are marked so the wall points back at their claim.
const WALL = [
  ['Video and sound', [['FFmpeg', 'ffmpeg'], ['Audacity', 'audacity'], ['Kdenlive', 'kdenlive'], ['Ardour', 'ardour'], ['SoX', 'sox'], ['HandBrake', 'handbrake-cli'], ['MKVToolNix', 'mkvtoolnix'], ['MediaInfo', 'mediainfo'], ['eSpeak NG', 'espeak-ng'], ['Rubber Band', 'rubberband-cli']]],
  ['Pictures', [['GIMP', 'gimp'], ['ImageMagick', 'imagemagick'], ['darktable', 'darktable'], ['RawTherapee', 'rawtherapee'], ['Krita', 'krita'], ['Inkscape', 'inkscape'], ['Hugin', 'hugin'], ['libvips', 'libvips-tools'], ['ExifTool', 'libimage-exiftool-perl'], ['Potrace', 'potrace']]],
  ['3D and making', [['Blender', 'blender'], ['OpenSCAD', 'openscad'], ['PrusaSlicer', 'prusa-slicer'], ['MeshLab', 'meshlab'], ['KiCad', 'kicad'], ['LibreCAD', 'librecad'], ['ADMesh', 'admesh']]],
  ['Paper and files', [['Tesseract', 'tesseract-ocr'], ['OCRmyPDF', 'ocrmypdf'], ['Ghostscript', 'ghostscript'], ['Poppler', 'poppler-utils'], ['qpdf', 'qpdf'], ['MuPDF', 'mupdf-tools'], ['rclone', 'rclone'], ['restic', 'restic'], ['BorgBackup', 'borgbackup']]],
  ['Maps and routes', [['QGIS', 'qgis'], ['GDAL', 'gdal-bin'], ['GRASS GIS', 'grass'], ['PostGIS', 'postgis'], ['PROJ', 'proj-bin'], ['SpatiaLite', 'spatialite-bin'], ['Osmium', 'osmium-tool'], ['osm2pgsql', 'osm2pgsql'], ['GPSBabel', 'gpsbabel']]],
  ['Documents and print', [['LibreOffice', 'libreoffice'], ['Pandoc', 'pandoc'], ['TeX Live', 'texlive'], ['Scribus', 'scribus'], ['calibre', 'calibre'], ['LilyPond', 'lilypond'], ['MuseScore', 'musescore3'], ['WeasyPrint', 'weasyprint'], ['Hunspell', 'hunspell']]],
  ['Data and numbers', [['SQLite', 'sqlite3'], ['R', 'r-base'], ['PostgreSQL', 'postgresql'], ['pandas', 'python3-pandas'], ['Jupyter', 'jupyter-notebook'], ['GNU Octave', 'octave'], ['gnuplot', 'gnuplot'], ['Graphviz', 'graphviz'], ['Miller', 'miller'], ['hledger', 'hledger']]],
  ['The web', [['Git', 'git'], ['Hugo', 'hugo'], ['Jekyll', 'jekyll'], ['Node.js', 'nodejs'], ['nginx', 'nginx'], ['Caddy', 'caddy'], ['Go', 'golang'], ['Rust', 'rustc']]],
];
const LEAD = new Set(LIBRARY.map(([n]) => n));

export default {
  id: 'library-intro',
  kind: 'section',
  html: () => `<p class="kicker">One ordinary server, everything on it</p>
    <h2>Tens of thousands of programs, a sentence away.</h2>
    <p>Every agent here works on an ordinary Ubuntu server, and Ubuntu’s archive holds tens of thousands of packages. Some of them lead their field. An administrator installs one for everyone; an agent fetches many into its own account the moment a job needs one.</p>
    <ul class="lib">${LIBRARY.map(([n, f, q, src, url]) => `<li><b>${esc(n)}</b><small>${esc(f)}</small><q>${esc(q.replace(/^“|”$/g, ''))}</q><a href="${url}">${esc(src)}</a></li>`).join('')}</ul>
    <figure class="li-wall">
      <p class="li-cmd" aria-hidden="true"><span>$</span> apt-cache show ffmpeg gimp blender tesseract-ocr qgis libreoffice r-base hugo …</p>
      <div class="li-groups">${WALL.map(([g, ps]) => `<section><h3>${esc(g)}</h3><ul>${ps.map(([n, pkg]) => `<li${LEAD.has(n) ? ' class="li-lead"' : ''} title="Ubuntu package: ${esc(pkg)}">${esc(n)}</li>`).join('')}</ul></section>`).join('')}</div>
      <figcaption><span class="li-key">★ quoted above.</span> A few of them, every one in Ubuntu 24.04’s archive. Others, like Whisper for speech or DuckDB for data, an agent fetches from the project itself.</figcaption>
    </figure>`,
};
