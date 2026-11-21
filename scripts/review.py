#!/usr/bin/env python3
"""Review crowdsourced submissions. Uses the AWS CLI (no extra Python packages).

  AWS_PROFILE=laurel scripts/review.py list [pending|approved|rejected|all]
  AWS_PROFILE=laurel scripts/review.py show <id>      # prints it, downloads files to submissions/<id>/
  AWS_PROFILE=laurel scripts/review.py approve <id> ["note"]
  AWS_PROFILE=laurel scripts/review.py reject <id> ["note"]
  AWS_PROFILE=laurel scripts/review.py purge [--yes]  # deletes reviewed-but-unpublished items >12 months old (privacy notice promise)

Approving only marks it reviewed. Publishing is still a normal edit to data/*.json
(with the submission id as the source) and a deploy.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

REGION = 'ap-southeast-1'
TABLE = 'bettersanjose-submissions'
BUCKET = 'bettersanjose-submissions-773994910221'
OUT = os.path.join(os.path.dirname(__file__), '..', 'submissions')  # gitignored


def aws(*args):
    r = subprocess.run(['aws', *args, '--region', REGION, '--output', 'json'], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr.strip())
    return json.loads(r.stdout) if r.stdout.strip() else {}


def plain(av):
    """DynamoDB attribute value -> Python value."""
    (t, v), = av.items()
    if t == 'M':
        return {k: plain(x) for k, x in v.items()}
    if t == 'L':
        return [plain(x) for x in v]
    if t == 'N':
        return int(v) if v.lstrip('-').isdigit() else float(v)
    return v


def items():
    out, start = [], None
    while True:
        args = ['dynamodb', 'scan', '--table-name', TABLE]
        if start:
            args += ['--exclusive-start-key', json.dumps(start)]
        page = aws(*args)
        out += [plain({'M': i}) for i in page.get('Items', [])]
        start = page.get('LastEvaluatedKey')
        if not start:
            return [i for i in out if not i['id'].startswith('rate#')]


def get(sid):
    item = aws('dynamodb', 'get-item', '--table-name', TABLE, '--key', json.dumps({'id': {'S': sid}})).get('Item')
    if not item:
        sys.exit(f'no submission {sid}')
    return plain({'M': item})


def set_status(sid, status, note=''):
    get(sid)
    aws('dynamodb', 'update-item', '--table-name', TABLE, '--key', json.dumps({'id': {'S': sid}}),
        '--update-expression', 'SET #s = :s, reviewed = :r, review_note = :n',
        '--expression-attribute-names', json.dumps({'#s': 'status'}),
        '--expression-attribute-values', json.dumps({
            ':s': {'S': status}, ':n': {'S': note},
            ':r': {'S': datetime.now(timezone.utc).isoformat(timespec='seconds')}}))
    print(f'{sid} -> {status}')


def main(argv):
    cmd = argv[1] if len(argv) > 1 else 'list'
    if cmd == 'list':
        want = argv[2] if len(argv) > 2 else 'pending'
        rows = sorted((i for i in items() if want == 'all' or i.get('status') == want), key=lambda i: i['id'])
        for i in rows:
            where = i.get('barangay_psgc') or 'municipality'
            print(f"{i['id']}  {i.get('status'):8}  {i.get('category'):11} {where:11} "
                  f"{len(i.get('files', []))}f  {i.get('title', '')[:60]}")
        print(f'{len(rows)} {want}')
    elif cmd == 'show':
        i = get(argv[2])
        print(json.dumps({k: v for k, v in i.items() if k != 'files'}, indent=2, ensure_ascii=False))
        for f in i.get('files', []):
            dest = os.path.join(OUT, i['id'], os.path.basename(f['key']))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            r = subprocess.run(['aws', 's3', 'cp', f"s3://{BUCKET}/{f['key']}", dest, '--region', REGION],
                               capture_output=True, text=True)
            print(('downloaded ' + dest) if r.returncode == 0 else f"missing (upload never finished): {f['key']}")
    elif cmd in ('approve', 'reject'):
        set_status(argv[2], {'approve': 'approved', 'reject': 'rejected'}[cmd], argv[3] if len(argv) > 3 else '')
    elif cmd == 'purge':
        cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        old = [i for i in items() if i.get('status') != 'published' and i.get('created', '') < cutoff]
        for i in old:
            print('purge', i['id'])
            if '--yes' in argv:
                subprocess.run(['aws', 's3', 'rm', f"s3://{BUCKET}/submissions/{i['id']}/", '--recursive',
                                '--region', REGION], capture_output=True)
                aws('dynamodb', 'delete-item', '--table-name', TABLE, '--key', json.dumps({'id': {'S': i['id']}}))
        print(f"{len(old)} item(s) {'deleted' if '--yes' in argv else 'would be deleted (add --yes)'}")
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    assert plain({'M': {'a': {'N': '3'}, 'b': {'L': [{'S': 'x'}, {'BOOL': True}]}}}) == {'a': 3, 'b': ['x', True]}
    main(sys.argv)
