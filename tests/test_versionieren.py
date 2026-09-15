"""Cache-Adressen bleiben nach Schreiben und erneutem Pruefen stabil."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('versionieren', ROOT / 'tools/versionieren.py')
versionieren = importlib.util.module_from_spec(spec)
spec.loader.exec_module(versionieren)


class FingerabdruckTest(unittest.TestCase):
    def test_schreiben_bleibt_lf_und_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'assets').mkdir()
            bild = root / 'assets/rad.png'
            bild.write_bytes(b'\x89PNG\r\n\x00\xff')
            css = root / 'style.css'
            css.write_bytes(b'.rad { background: url("assets/rad.png"); }\n')
            js = root / 'script.js'
            js.write_bytes(b"const rad = 'assets/rad.png';\n")
            html = root / 'index.html'
            html.write_bytes(b'<link href="style.css">\n<script src="script.js"></script>\n')

            for stamp, file in [(versionieren.bilder_stempeln, css),
                                (versionieren.bilder_in_skript_stempeln, js),
                                (versionieren.stempeln, html)]:
                self.assertTrue(stamp(file, False))
                self.assertNotIn(b'\r\n', file.read_bytes())
                self.assertEqual(stamp(file, True), [])
                before = file.read_bytes()
                self.assertEqual(stamp(file, False), [])
                self.assertEqual(file.read_bytes(), before)
            self.assertEqual(bild.read_bytes(), b'\x89PNG\r\n\x00\xff')


if __name__ == '__main__':
    unittest.main()
