"""Stage only reviewed public assets; repository files are never the output root."""
from pathlib import Path
import shutil

PUBLIC_FILES = (
    'index.html', '404.html', 'a11y.css', 'app.js', 'ecosystem-globe.css',
    'favicon.svg', 'llms.txt', 'mobile-nav.css', 'robots.txt', 'site.webmanifest',
    'sitemap.xml', 'social-card.svg', 'styles.css', '.well-known/security.txt',
    'accessibility/index.html', 'company/index.html', 'contact/index.html',
    'ecosystem/index.html', 'engagement/index.html', 'governance/index.html',
    'industries/index.html', 'knowledge/index.html', 'library/index.html',
    'platforms/autto-connect/index.html', 'platforms/csia/index.html',
    'platforms/solurius/index.html', 'platforms/wardale/index.html',
    'privacy/index.html', 'research/index.html', 'security/index.html',
    'start/index.html', 'technology/index.html', 'terms/index.html', 'trust/index.html',
)


def build(root: Path) -> Path:
    root = root.resolve()
    output = root / '.static-output'
    if output.is_symlink():
        raise ValueError('Output must not be a symlink')
    for relative in PUBLIC_FILES:
        source = root / relative
        if not source.is_file():
            raise ValueError(f'Missing approved public asset: {relative}')
        for component in (source, *source.parents):
            if component == root:
                break
            if component.is_symlink():
                raise ValueError(f'Symlink is not a public asset: {relative}')
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()
    for relative in PUBLIC_FILES:
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / relative, destination)
    actual = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
    if actual != set(PUBLIC_FILES):
        raise RuntimeError('Unexpected deployment output')
    return output


if __name__ == '__main__':
    directory = build(Path(__file__).resolve().parents[1])
    print(f'Staged {len(PUBLIC_FILES)} approved public assets in {directory.name}')
