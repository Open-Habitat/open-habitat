// The capability section's intro: tens of thousands of programs, the four
// field-leading claims with their sources (round 6 NOTES, "Claims to verify")
// and the programs checked in the Ubuntu archive. The group links under it
// are drawn by the engine from the caps-* blocks. Ported from round 6, unchanged.
import { esc } from '../../engine/kit.mjs';

// A claim of leadership only with its source; the quotation is the source's own sentence.
const LIBRARY = [
  ['FFmpeg', 'Video and sound', '“FFmpeg is the leading multimedia framework”', 'ffmpeg.org', 'https://ffmpeg.org/about.html'],
  ['SQLite', 'Databases', '“SQLite is the most widely deployed database in the world”', 'sqlite.org', 'https://sqlite.org/about.html'],
  ['QGIS', 'Maps', '“QGIS is the leading Free and Open Source Desktop GIS.”', 'osgeo.org', 'https://www.osgeo.org/projects/qgis/'],
  ['Git', 'Version history', '“Git is widely used”', 'git-scm.com', 'https://git-scm.com/about'],
];
// Checked with apt-cache show on Ubuntu 24.04: all of these are in the archive.
const ALSO = ['Blender', 'LibreOffice', 'Pandoc', 'ImageMagick', 'Tesseract', 'OCRmyPDF', 'Inkscape', 'Scribus', 'LilyPond', 'MuseScore', 'darktable', 'Hugin', 'GDAL', 'R', 'OpenSCAD', 'Graphviz', 'calibre', 'Hugo'];

export default {
  id: 'library-intro',
  kind: 'section',
  html: () => `<p class="kicker">What an agent on a real computer can do</p>
    <h2>Tens of thousands of programs, a sentence away.</h2>
    <p>Every agent here works on Ubuntu, and Ubuntu offers tens of thousands of packages. Some of them lead their field. An administrator can install any of them for everyone, and an agent fetches many of them into its own account the moment a job needs one.</p>
    <ul class="lib">${LIBRARY.map(([n, f, q, src, url]) => `<li><b>${esc(n)}</b><small>${esc(f)}</small><q>${esc(q.replace(/^“|”$/g, ''))}</q><a href="${url}">${esc(src)}</a></li>`).join('')}</ul>
    <p class="lib-also">Also in the archive: ${ALSO.map(esc).join(', ')}. Others, like Whisper for speech or DuckDB for data, an agent fetches from the project itself.</p>`,
};
