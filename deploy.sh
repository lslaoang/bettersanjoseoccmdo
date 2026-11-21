#!/usr/bin/env bash
# Build and publish to S3 + CloudFront. Usage: AWS_PROFILE=laurel ./deploy.sh
set -euo pipefail
BUCKET=bettersanjose-773994910221
DIST=E16BJAJIZULPF0

npm run build
# Hashed assets never change: cache for a year.
aws s3 sync dist/assets "s3://$BUCKET/assets" --delete \
  --cache-control 'public,max-age=31536000,immutable'
# Everything else (index.html, locales, icons): always revalidate.
aws s3 sync dist "s3://$BUCKET" --delete --exclude 'assets/*' \
  --cache-control 'no-cache'
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' \
  --query Invalidation.Id --output text
