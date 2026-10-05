"""Collector integration tests: all Git mutations stay in temporary fixture repositories."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('portfolio-evidence.py').resolve()


class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / 'repo'
        self.repo.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.put('web/src/App.jsx', 'export function App() { return null; }\n')
        self.put('server/src/routes/auth.js', "router.post('/login', handler);\n")
        self.put('docs/features/README.md', '| F001 | Authentication | Done |\n')
        self.put('docs/features/infra/F007-local-stage-environment.md', '# Environment decisions\n')
        self.put('server/.env.stage', 'NEVER_READ=private-fixture\n')
        self.put('server/src/service-account.json', '{"private_key":"private-fixture"}')
        self.put('server/src/config/credentials.js', 'private-fixture')
        self.put('server/test/fixtures/records.js', 'private-fixture')
        self.put('docs/portfolio/progress/private.md', 'private-fixture')
        outside = Path(self.temp.name) / 'outside.js'
        outside.write_text('private-fixture')
        (self.repo / 'web/src/symlink.js').symlink_to(outside)
        self.git('add', '.')
        self.git('commit', '-qm', 'Initial fixture')
        self.first = self.git('rev-parse', 'HEAD').strip()
        self.output = Path(self.temp.name) / 'output'

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], text=True)

    def put(self, path, text):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def run_cli(self, *args, ok=True):
        result = subprocess.run(['python3', str(SCRIPT), '--repo', str(self.repo), *map(str, args)], capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, ok, result.stderr)
        return result

    def collect(self, source=None, *args):
        result = self.run_cli('collect', '--source', source or self.first, '--output-dir', self.output, *args)
        return Path(result.stdout.strip()).with_name('packet.json')

    def test_commit_only_privacy_and_idempotence(self):
        self.put('web/src/App.jsx', 'uncommitted\n' * 20)
        packet = self.collect()
        data = json.loads(packet.read_text())
        self.assertEqual(data['evidence']['measurements']['source_files'], 2)
        self.assertEqual(data['evidence']['measurements']['physical_lines'], 2)
        self.assertEqual(data['evidence']['measurements']['rest_operations'], 1)
        inventory = data['evidence']['inventory']
        self.assertIn('docs/features/infra/F007-local-stage-environment.md', inventory)
        self.assertFalse(any('.env' in p or 'symlink' in p or 'credentials' in p or 'fixtures' in p or 'service-account' in p for p in inventory))
        self.assertNotIn('private-fixture', packet.read_text())
        data['owner_notes'] = 'Preserve this review'
        packet.write_text(json.dumps(data))
        self.run_cli('collect', '--source', self.first, '--output-dir', self.output, ok=False)
        self.assertEqual(json.loads(packet.read_text())['owner_notes'], 'Preserve this review')

    def test_delta_and_working_tree_are_separate(self):
        self.put('web/src/App.jsx', 'committed change\nsecond line\n')
        self.git('add', 'web/src/App.jsx'); self.git('commit', '-qm', 'Second fixture')
        second = self.git('rev-parse', 'HEAD').strip()
        packet = json.loads(self.collect(second, '--previous', self.first).read_text())
        self.assertEqual(packet['evidence']['changes'], [{'path': 'web/src/App.jsx', 'status': 'Modified'}])
        self.assertEqual(len(packet['evidence']['history']), 1)
        self.put('web/src/New.jsx', 'new draft\n')
        working = json.loads(self.collect(second, '--previous', self.first, '--working-tree').read_text())
        self.assertEqual(working['evidence']['measurements']['source_files'], 2)
        self.assertEqual(working['evidence']['working_tree']['measurements']['source_files'], 3)
        self.assertIn('working-', working['snapshot_id'])
        self.run_cli('collect', '--source', self.first, '--previous', second, '--output-dir', self.output, ok=False)

    def test_manual_gate_and_checkpoint(self):
        packet = self.collect()
        checkpoint = self.repo / 'checkpoint.json'
        checkpoint.write_text(json.dumps({'last_reviewed_source_commit': None, 'reviews': []}))
        before = checkpoint.read_bytes()
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, ok=False)
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, '--confirm-reviewed', ok=False)
        data = json.loads(packet.read_text())
        claim = {'id': 'C01', 'title': 'Fixture', 'source_commit': self.first, 'evidence_references': ['web/src/App.jsx'], 'what_changed': 'Fixture', 'demonstrated_skill': 'Fixture', 'implemented': 'Source only', 'tested': 'Unknown', 'deployed': 'Unknown', 'proposed_wording': 'Proposed', 'qualifications': 'Fixture', 'review_status': 'Pending', 'approved_wording': ''}
        data['claims'] = [claim]; packet.write_text(json.dumps(data))
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, '--confirm-reviewed', ok=False)
        claim['review_status'] = 'Approved'; packet.write_text(json.dumps(data))
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, '--confirm-reviewed', ok=False)
        self.assertEqual(checkpoint.read_bytes(), before)
        claim['approved_wording'] = 'Owner approved text'; packet.write_text(json.dumps(data))
        self.run_cli('render', '--packet', packet)
        self.assertIn('Owner approved text', packet.with_name('REVIEW.md').read_text())
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, '--confirm-reviewed')
        self.assertEqual(json.loads(checkpoint.read_text())['last_reviewed_source_commit'], self.first)
        self.assertEqual(json.loads(packet.read_text())['review_status'], 'Reviewed')
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, '--confirm-reviewed', ok=False)

    def test_working_packet_cannot_advance_checkpoint(self):
        packet = self.collect(self.first, '--working-tree')
        data = json.loads(packet.read_text())
        data['claims'] = [{'id': 'C01', 'title': 'Rejected', 'source_commit': self.first, 'evidence_references': ['web/src/App.jsx'], 'what_changed': '', 'demonstrated_skill': '', 'implemented': 'Unknown', 'tested': 'Unknown', 'deployed': 'Unknown', 'proposed_wording': '', 'qualifications': '', 'review_status': 'Rejected', 'approved_wording': ''}]
        packet.write_text(json.dumps(data))
        checkpoint = self.repo / 'checkpoint.json'
        checkpoint.write_text('{"last_reviewed_source_commit":null}')
        self.run_cli('complete-review', '--packet', packet, '--checkpoint', checkpoint, '--confirm-reviewed', ok=False)
        self.assertIsNone(json.loads(checkpoint.read_text())['last_reviewed_source_commit'])


if __name__ == '__main__':
    unittest.main()
