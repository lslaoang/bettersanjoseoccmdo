"""Crowdsourced submissions for Better San Jose.

POST /api/submissions  -> validates the form, stores it as `pending`, and returns
presigned S3 POST forms so the browser can upload files directly (size/type
enforced by S3 policy). Nothing here is ever published automatically: a
maintainer reviews every submission (scripts/review.py).

Env: TABLE, BUCKET.  Run `python3 api/submit.py` for the self-check.
"""
import hashlib
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone

CATEGORIES = {
    'officials', 'hotlines', 'services', 'projects', 'ordinances', 'budget',
    'places', 'events', 'correction', 'other',
}
SOURCE_TYPES = {'official_document', 'official_posting', 'news', 'first_hand', 'own_photo', 'other'}
RELATIONS = {'resident', 'barangay_official', 'lgu_employee', 'visitor', 'other'}
FILE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'}
MAX_FILES, MAX_BYTES = 5, 10 * 1024 * 1024
RATE_PER_HOUR = 5
PSGC = re.compile(r'^1705110\d{3}$')
ISO_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _s(body, key, maxlen, required=False):
    v = body.get(key)
    v = v.strip() if isinstance(v, str) else ''
    if required and not v:
        raise ValueError(f'{key} is required')
    if len(v) > maxlen:
        raise ValueError(f'{key} is too long (max {maxlen})')
    return v


def validate(body):
    """Return a clean submission dict or raise ValueError with a user-facing message."""
    if body.get('website'):  # honeypot: humans never see this field
        raise ValueError('spam')
    scope = body.get('scope')
    if scope not in ('municipality', 'barangay'):
        raise ValueError('scope must be municipality or barangay')
    psgc = _s(body, 'barangay_psgc', 10)
    if scope == 'barangay' and not PSGC.match(psgc):
        raise ValueError('choose a barangay')
    if body.get('category') not in CATEGORIES:
        raise ValueError('choose a category')
    if body.get('source_type') not in SOURCE_TYPES:
        raise ValueError('say how you know this')
    relation = body.get('relation') or 'other'
    if relation not in RELATIONS:
        raise ValueError('invalid relation')
    as_of = _s(body, 'as_of', 10)
    if as_of and not ISO_DATE.match(as_of):
        raise ValueError('as_of must be YYYY-MM-DD')
    source_url = _s(body, 'source_url', 500)
    if source_url and not source_url.startswith(('https://', 'http://')):
        raise ValueError('source link must start with http(s)://')

    files = body.get('files') or []
    if not isinstance(files, list) or len(files) > MAX_FILES:
        raise ValueError(f'up to {MAX_FILES} files')
    clean_files = []
    for f in files:
        if not isinstance(f, dict) or f.get('type') not in FILE_TYPES:
            raise ValueError('files must be JPG, PNG, WebP, HEIC or PDF')
        size = f.get('size')
        if not isinstance(size, int) or not 0 < size <= MAX_BYTES:
            raise ValueError('each file must be 10 MB or smaller')
        name = re.sub(r'[^A-Za-z0-9._-]+', '_', str(f.get('name', 'file')))[-80:]
        clean_files.append({'name': name, 'type': f['type'], 'size': size})
    if clean_files and not body.get('license_ok'):
        raise ValueError('agree to the photo/document terms to upload files')
    if not body.get('privacy_ok'):
        raise ValueError('please accept the privacy notice')

    return {
        'scope': scope,
        'barangay_psgc': psgc if scope == 'barangay' else '',
        'category': body['category'],
        'title': _s(body, 'title', 150, required=True),
        'details': _s(body, 'details', 5000, required=True),
        'source_type': body['source_type'],
        'source_url': source_url,
        'as_of': as_of,
        'relation': relation,
        'submitter_name': _s(body, 'submitter_name', 100),
        'submitter_contact': _s(body, 'submitter_contact', 150),
        'credit_ok': bool(body.get('credit_ok')),
        'license_ok': bool(body.get('license_ok')),
        'files': clean_files,
    }


def _resp(status, payload):
    return {
        'statusCode': status,
        'headers': {'content-type': 'application/json', 'cache-control': 'no-store'},
        'body': json.dumps(payload),
    }


def handler(event, _context):
    import boto3  # available in the Lambda runtime; kept out of the self-check

    if event.get('requestContext', {}).get('http', {}).get('method') != 'POST':
        return _resp(405, {'error': 'POST only'})
    try:
        body = json.loads(event.get('body') or '{}')
        sub = validate(body)
    except ValueError as e:
        return _resp(422, {'error': str(e)})
    except json.JSONDecodeError:
        return _resp(400, {'error': 'bad JSON'})

    table = boto3.resource('dynamodb').Table(os.environ['TABLE'])
    # Behind CloudFront, sourceIp is the edge; CloudFront-Viewer-Address ("ip:port") is the visitor and can't be spoofed.
    viewer = event.get('headers', {}).get('cloudfront-viewer-address', '')
    ip = viewer.rsplit(':', 1)[0] if viewer else event['requestContext']['http'].get('sourceIp', '')
    ip_hash = hashlib.sha256((os.environ['TABLE'] + ip).encode()).hexdigest()[:16]
    hour = int(time.time() // 3600)
    # ponytail: per-IP hourly counter; shared IPs (schools, mobile CGNAT) may hit it. Raise RATE_PER_HOUR if so.
    count = table.update_item(
        Key={'id': f'rate#{ip_hash}#{hour}'},
        UpdateExpression='ADD n :one SET #ttl = :ttl',
        ExpressionAttributeNames={'#ttl': 'ttl'},
        ExpressionAttributeValues={':one': 1, ':ttl': (hour + 2) * 3600},
        ReturnValues='UPDATED_NEW',
    )['Attributes']['n']
    if count > RATE_PER_HOUR:
        return _resp(429, {'error': 'Too many submissions from your network. Try again in an hour.'})

    now = datetime.now(timezone.utc)
    sid = now.strftime('%Y%m%d-%H%M%S-') + secrets.token_hex(3)
    from botocore.config import Config

    region = os.environ['AWS_REGION']  # regional endpoint: the global one 307-redirects for new buckets
    s3 = boto3.client('s3', region_name=region, endpoint_url=f'https://s3.{region}.amazonaws.com',
                      config=Config(signature_version='s3v4', s3={'addressing_style': 'virtual'}))
    uploads = []
    for i, f in enumerate(sub['files']):
        key = f'submissions/{sid}/{i + 1}-{f["name"]}'
        f['key'] = key
        uploads.append(s3.generate_presigned_post(
            os.environ['BUCKET'], key,
            Fields={'Content-Type': f['type']},
            Conditions=[{'Content-Type': f['type']}, ['content-length-range', 1, MAX_BYTES]],
            ExpiresIn=900,
        ))
    table.put_item(Item={
        'id': sid, 'status': 'pending', 'created': now.isoformat(timespec='seconds'),
        'ip_hash': ip_hash, 'user_agent': event.get('headers', {}).get('user-agent', '')[:200],
        **sub,
    })
    return _resp(201, {'id': sid, 'uploads': uploads})


if __name__ == '__main__':
    ok = {
        'scope': 'barangay', 'barangay_psgc': '1705110021', 'category': 'officials',
        'title': 'Punong barangay', 'details': 'Name of the captain', 'source_type': 'first_hand',
        'privacy_ok': True, 'files': [{'name': 'a b.jpg', 'type': 'image/jpeg', 'size': 1000}],
        'license_ok': True,
    }
    assert validate(ok)['files'][0]['name'] == 'a_b.jpg'

    def bad(**kw):
        try:
            validate({**ok, **kw})
        except ValueError:
            return True
        return False

    assert bad(website='spam')
    assert bad(barangay_psgc='1705120001')
    assert bad(category='nope')
    assert bad(files=[{'name': 'x.exe', 'type': 'application/x-msdownload', 'size': 5}])
    assert bad(files=[{'name': 'x.jpg', 'type': 'image/jpeg', 'size': MAX_BYTES + 1}])
    assert bad(license_ok=False)
    assert bad(privacy_ok=False)
    assert bad(title='')
    assert bad(source_url='javascript:alert(1)')
    assert validate({**ok, 'scope': 'municipality', 'barangay_psgc': 'x'})['barangay_psgc'] == ''
    print('submit.py self-check ok')
