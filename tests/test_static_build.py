from pathlib import Path
import importlib.util
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('build_static', Path(__file__).resolve().parents[1] / 'scripts/build_static.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StaticPublicationBoundary(unittest.TestCase):
    def fixture(self, root):
        for name in module.PUBLIC_FILES:
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('synthetic public fixture', encoding='utf8')

    def test_only_reviewed_public_assets_are_staged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            for name in ('docs/internal.md', 'supabase/migrations/private.sql', '.env', 'tests/case.py', 'vercel.json', 'company/unapproved.html', 'library/private.pdf'):
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('never publish', encoding='utf8')
            output = module.build(root)
            actual = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
            self.assertEqual(actual, set(module.PUBLIC_FILES))
            self.assertTrue((output / '.well-known/security.txt').is_file())

    def test_stale_output_is_not_retained(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            output = module.build(root)
            (output / 'stale-secret.txt').write_text('stale')
            module.build(root)
            self.assertFalse((output / 'stale-secret.txt').exists())

    def test_missing_public_asset_fails_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                module.build(Path(tmp))

    def test_source_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / 'index.html').unlink()
            (root / 'index.html').symlink_to(root / '404.html')
            with self.assertRaises(ValueError):
                module.build(root)

    def test_output_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / '.static-output').symlink_to(root / 'company', target_is_directory=True)
            with self.assertRaises(ValueError):
                module.build(root)
            self.assertTrue((root / 'company/index.html').exists())


if __name__ == '__main__':
    unittest.main()
