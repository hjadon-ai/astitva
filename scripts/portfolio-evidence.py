#!/usr/bin/env python3
"""Local, dependency-free Git evidence collection. Never runs application code."""
import argparse
import collections
import datetime
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from zoneinfo import ZoneInfo

VERSION = 1
EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.swift', '.css', '.html', '.sh', '.rules'}
ROOT_FILES = {'README.md', 'AGENTS.md', 'INSTRUCTIONS.md', 'firebase.json', 'firestore.rules', 'render.yaml'}
BLOCKED = {'.git', '.agents', '.claude', '.codex', '.local', 'node_modules', 'dist', 'build', 'fixtures', 'public', 'assets', 'progress'}


def allowed(path):
    p = PurePosixPath(path)
    if p.is_absolute() or '..' in p.parts or any(x in BLOCKED for x in p.parts):
        return False
    if p.name.startswith('.env') or re.search(r'credential|secret|service.?account|private.?key|postman|(?:package-|yarn|pnpm-)lock|resolved', p.name, re.I):
        return False
    if path in ROOT_FILES:
        return True
    if p.name in {'AGENTS.md', 'INSTRUCTIONS.md'} and p.parts[0] in {'server', 'web', 'docs'}:
        return True
    if path in {'server/package.json', 'web/package.json', 'web/vite.config.js'}:
        return True
    if path.startswith(('server/src/', 'web/src/', 'server/test/', 'web/test/')):
        return p.suffix in EXTENSIONS
    if path.startswith(('docs/features/', 'docs/infra/', 'chatgpt-project/')):
        return p.suffix == '.md'
    if path.startswith('.github/workflows/'):
        return p.suffix in {'.yml', '.yaml'}
    if path.startswith('server/design/'):
        return p.name in {'openapi.yaml', 'mongodb-collections.md'} or p.name.endswith('.openapi.json')
    return path.startswith('scripts/') and p.suffix in {'.js', '.sh'}


def git(repo, *args):
    result = subprocess.run(['git', '--no-optional-locks', '-C', str(repo), *args], capture_output=True)
    if result.returncode:
        raise ValueError('Git operation failed: ' + ' '.join(args[:2]))
    return result.stdout


def commit(repo, value):
    resolved = git(repo, 'rev-parse', '--verify', '--end-of-options', value + '^{commit}').decode().strip()
    if not re.fullmatch(r'[a-f0-9]{40,64}', resolved):
        raise ValueError('Invalid commit')
    return resolved


def tree(repo, sha):
    result = {}
    for entry in git(repo, 'ls-tree', '-r', '-z', sha).split(b'\0'):
        if not entry:
            continue
        meta, name = entry.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        path = name.decode('utf-8')
        if kind == 'blob' and mode in {'100644', '100755'} and allowed(path):
            result[path] = git(repo, 'cat-file', 'blob', oid).decode('utf-8', errors='replace')
    return result


def working_tree(repo):
    result = {}
    names = git(repo, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split(b'\0')
    for raw in names:
        if not raw:
            continue
        name = raw.decode('utf-8')
        if not allowed(name):
            continue
        path = repo / name
        if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != repo.parent):
            continue
        if path.is_file() and path.resolve().is_relative_to(repo.resolve()):
            result[name] = path.read_text(errors='replace')
    return result


def measure(files):
    languages = collections.defaultdict(lambda: {'files': 0, 'physical_lines': 0})
    areas = collections.defaultdict(lambda: {'files': 0, 'physical_lines': 0})
    for name, text in files.items():
        ext = PurePosixPath(name).suffix
        if ext not in EXTENSIONS:
            continue
        lines = len(text.splitlines())
        for bucket in [languages[ext], areas[name.split('/')[0]]]:
            bucket['files'] += 1
            bucket['physical_lines'] += lines
    routes = []
    for name, text in files.items():
        if name.startswith('server/src/routes/'):
            for method, path in re.findall(r'router\.(get|post|put|patch|delete)\(\s*[\'"]([^\'"]+)', text):
                routes.append({'method': method.upper(), 'path': ('/api/' + Path(name).stem + path).rstrip('/'), 'evidence': name})
    if "app.get('/api/health'" in files.get('server/src/app.js', ''):
        routes.append({'method': 'GET', 'path': '/api/health', 'evidence': 'server/src/app.js'})
    feature_rows = []
    for line in files.get('docs/features/README.md', '').splitlines():
        cells = [x.strip() for x in line.split('|')]
        if len(cells) > 3 and re.fullmatch(r'F\d+', cells[1]):
            feature_rows.append({'id': cells[1], 'title': cells[2], 'status': cells[3]})
    return {'methodology': 'Allowlisted tracked source/test files; physical lines include blanks/comments. No generated output, dependencies, assets, locks, credentials, environment files, or local tooling. Static counts do not prove execution or deployment.',
            'source_files': sum(v['files'] for v in languages.values()),
            'physical_lines': sum(v['physical_lines'] for v in languages.values()),
            'languages': dict(sorted(languages.items())), 'areas': dict(sorted(areas.items())),
            'rest_operations': len(routes), 'routes': routes,
            'mongoose_model_definitions': sum(len(re.findall(r'mongoose\.model\(', text)) for name, text in files.items() if name.startswith('server/src/models/')),
            'test_declarations': sum(len(re.findall(r'\btest\s*\(', text)) for name, text in files.items() if name.startswith(('server/test/', 'web/test/'))),
            'features': feature_rows, 'feature_status_counts': dict(collections.Counter(x['status'] for x in feature_rows))}


def render(packet):
    e = packet['evidence']
    m = e['measurements']
    lines = [f"# Portfolio review packet: {packet['snapshot_id']}", '', f"Generated: {packet['generated_at']}",
             f"Source commit: `{packet['source_commit']}`", f"Previous reviewed commit: `{packet['previous_reviewed_commit'] or 'None — initial baseline'}`", '',
             '## Boundaries', '', 'Deterministic collection is separate from Codex interpretation below. All claims begin Pending. Feature status, test declarations, and hosting configuration are not proof of verification or deployment. No application code/tests were executed; no network/deployment probe was made. iOS and Portfolio are not collected by this script.', '',
             'Historical context: ASTITVA_ENGINEERING_REPORT.md is the October 4 working-tree audit, including uncommitted F032/iOS work. It is not this committed baseline or current deployment evidence.', '',
             '## Measurements', '', f"- Source files: {m['source_files']}; physical lines: {m['physical_lines']}.",
             f"- Registered REST operations: {m['rest_operations']} (may include retired compatibility routes).",
             f"- Mongoose model definitions: {m['mongoose_model_definitions']}.",
             f"- Static test declarations: {m['test_declarations']}; execution: Not run by collector.",
             f"- Feature-index status counts: {json.dumps(m['feature_status_counts'], sort_keys=True)}.", '', m['methodology'], '',
             'Full language/area breakdown, route inventory, and feature rows are in packet.json.', '',
             '## Changed evidence files', '', 'No previous reviewed snapshot: inventory of baseline files.' if not packet['previous_reviewed_commit'] else 'Changes since the explicit previous reviewed commit.']
    lines += [f"- {item['status']}: `{item['path']}`" for item in e['changes']]
    lines += ['', '## Git history', '', f"Reachable commits: {e['reachable_commits']}. Earliest/latest recorded commit dates: {e['timeline']['first']} / {e['timeline']['latest']}.", 'Subjects below are recorded history, not automatic public claims.']
    lines += [f"- `{x['commit'][:12]}` {x['date']}: {x['subject']}" for x in e['history']]
    lines += ['', '## Optional working-tree evidence', '', 'Not requested; uncommitted work excluded.'] if not e.get('working_tree') else ['', '## Optional working-tree evidence', '', 'UNCOMMITTED — separate from source-commit evidence; not eligible to advance a committed checkpoint.', json.dumps(e['working_tree'], indent=2)]
    lines += ['', '## Codex interpretation and claim review', '', 'Edit claims in packet.json, then run render. Markdown is a presentation; packet.json is authoritative. Approval requires exact approved wording.']
    for c in packet['claims']:
        lines += ['', f"### {c['id']}: {c['title']}", '', f"Source commit: `{c['source_commit']}`", 'Evidence: ' + '; '.join(f"`{x}`" for x in c['evidence_references'])]
        for key, label in [('what_changed', 'What changed'), ('demonstrated_skill', 'Demonstrated skill'), ('implemented', 'Implementation'), ('tested', 'Verification'), ('deployed', 'Deployment'), ('proposed_wording', 'Proposed public wording'), ('qualifications', 'Qualifications'), ('review_status', 'Review status'), ('approved_wording', 'Approved wording'), ('review_notes', 'Review notes')]:
            lines += [f"**{label}:** {c.get(key, '')}"]
    if not packet['claims']:
        lines += ['', 'No claims drafted by the deterministic collector. Ask Codex to inspect commit-scoped evidence and populate claims using the documented schema.']
    lines += ['', '## Manual review', '', 'Approve exact wording, revise, or reject every claim. Complete review explicitly only when every claim is Approved or Rejected. Approval permits portfolio preparation, not publication.']
    return '\n'.join(lines) + '\n'


def load(path):
    return json.loads(path.read_text())


def collect(args, repo):
    source = commit(repo, args.source)
    previous = commit(repo, args.previous) if args.previous else None
    if previous and subprocess.run(['git', '-C', str(repo), 'merge-base', '--is-ancestor', previous, source], capture_output=True).returncode:
        raise ValueError('Previous reviewed commit must be an ancestor of source')
    files = tree(repo, source)
    before = tree(repo, previous) if previous else {}
    changes = [{'path': name, 'status': 'Added' if name not in before else 'Deleted' if name not in files else 'Modified'}
               for name in sorted(set(files) | set(before)) if files.get(name) != before.get(name)]
    digest = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    evidence = {'measurements': measure(files), 'changes': changes, 'inventory': sorted(files), 'content_digest': digest,
                'reachable_commits': int(git(repo, 'rev-list', '--count', source)), 'history': []}
    history = git(repo, 'log', '--format=%H%x09%cs%x09%s', f'{previous}..{source}' if previous else source).decode().splitlines()
    for line in history:
        sha, date, subject = line.split('\t', 2)
        evidence['history'].append({'commit': sha, 'date': date, 'subject': subject})
    dates = git(repo, 'log', '--format=%cs', source).decode().splitlines()
    evidence['timeline'] = {'first': dates[-1], 'latest': dates[0]}
    suffix = ''
    if args.working_tree:
        working = working_tree(repo)
        wd = hashlib.sha256(json.dumps(working, sort_keys=True).encode()).hexdigest()
        evidence['working_tree'] = {'status': 'Uncommitted; not attributed to source commit', 'content_digest': wd,
                                    'changed_paths': sorted(n for n in set(files) | set(working) if files.get(n) != working.get(n)), 'measurements': measure(working)}
        suffix = '-working-' + wd[:12]
    identity = f'astitva-v{VERSION}-{source}-{previous or "initial"}{suffix}'
    now = datetime.datetime.now(ZoneInfo('America/Los_Angeles')).isoformat(timespec='seconds')
    packet = {'schema_version': VERSION, 'snapshot_id': identity, 'generated_at': now, 'source_commit': source,
              'previous_reviewed_commit': previous, 'review_status': 'Pending', 'evidence': evidence, 'claims': []}
    destination = args.output_dir / identity
    if destination.exists():
        raise ValueError(f'Snapshot already exists; preserved without overwriting review: {destination}')
    destination.mkdir(parents=True)
    (destination / 'packet.json').write_text(json.dumps(packet, indent=2) + '\n')
    (destination / 'REVIEW.md').write_text(render(packet))
    print(destination / 'REVIEW.md')


def finish(args, repo):
    if not args.confirm_reviewed:
        raise ValueError('Explicit --confirm-reviewed is required; drafts never advance checkpoint')
    path = args.packet
    packet = load(path)
    checkpoint = load(args.checkpoint)
    claims = packet['claims']
    if not claims or any(c.get('review_status') not in {'Approved', 'Rejected'} for c in claims):
        raise ValueError('Every claim must be explicitly Approved or Rejected')
    if any(c['review_status'] == 'Approved' and not c.get('approved_wording', '').strip() for c in claims):
        raise ValueError('Every approved claim needs exact approved wording')
    required = {'id', 'title', 'source_commit', 'evidence_references', 'what_changed', 'demonstrated_skill', 'implemented', 'tested', 'deployed', 'proposed_wording', 'qualifications', 'review_status', 'approved_wording'}
    if any(not required.issubset(c) or not isinstance(c['evidence_references'], list) or not c['evidence_references'] for c in claims):
        raise ValueError('Every claim must include the documented fields and evidence references')
    source = commit(repo, packet['source_commit'])
    if len({c['id'] for c in claims}) != len(claims) or any(c['source_commit'] != source for c in claims):
        raise ValueError('Claim IDs must be unique and source commits must match')
    if checkpoint['last_reviewed_source_commit'] != packet['previous_reviewed_commit']:
        raise ValueError('Checkpoint differs from packet baseline; prepare a new packet')
    if packet['evidence'].get('working_tree'):
        raise ValueError('Working-tree packets cannot advance the committed checkpoint')
    packet['review_status'] = 'Reviewed'
    packet['reviewed_at'] = datetime.datetime.now(ZoneInfo('America/Los_Angeles')).isoformat(timespec='seconds')
    checkpoint['last_reviewed_source_commit'] = source
    checkpoint['last_reviewed_snapshot_id'] = packet['snapshot_id']
    checkpoint['reviewed_at'] = packet['reviewed_at']
    checkpoint.setdefault('reviews', []).append({'snapshot_id': packet['snapshot_id'], 'source_commit': source,
        'decisions': [{'id': c['id'], 'status': c['review_status'], 'approved_wording': c.get('approved_wording', ''), 'notes': c.get('review_notes', '')} for c in claims]})
    path.write_text(json.dumps(packet, indent=2) + '\n')
    path.with_name('REVIEW.md').write_text(render(packet))
    args.checkpoint.write_text(json.dumps(checkpoint, indent=2) + '\n')
    print('Review recorded. Portfolio modification/publication are separate actions.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('collect'); p.add_argument('--source', required=True); p.add_argument('--previous'); p.add_argument('--working-tree', action='store_true'); p.add_argument('--output-dir', type=Path)
    p = sub.add_parser('render'); p.add_argument('--packet', type=Path, required=True)
    p = sub.add_parser('complete-review'); p.add_argument('--packet', type=Path, required=True); p.add_argument('--checkpoint', type=Path); p.add_argument('--confirm-reviewed', action='store_true')
    args = parser.parse_args(); repo = args.repo.resolve()
    try:
        if args.command == 'collect':
            args.output_dir = args.output_dir or repo / 'docs/portfolio/progress'; collect(args, repo)
        elif args.command == 'render':
            args.packet.with_name('REVIEW.md').write_text(render(load(args.packet))); print(args.packet.with_name('REVIEW.md'))
        else:
            args.checkpoint = args.checkpoint or repo / 'docs/portfolio/progress/checkpoint.json'; finish(args, repo)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
