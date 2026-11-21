#!/usr/bin/env bash
# One-time setup (safe to re-run for code updates) of the submissions backend:
#   DynamoDB table + private S3 bucket + Lambda + HTTP API, routed through the
#   site's CloudFront distribution at /api/* so the form is same-origin.
# Usage: AWS_PROFILE=laurel ./api/infra.sh
set -euo pipefail
cd "$(dirname "$0")"
export AWS_PAGER=""
R=ap-southeast-1
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
NAME=bettersanjose-submissions
TABLE=$NAME
BUCKET=$NAME-$ACCOUNT
ROLE=$NAME-lambda
DIST=E16BJAJIZULPF0
ORIGINS='["https://djy3esom4bpw1.cloudfront.net","http://localhost:5188"]'

# --- storage -----------------------------------------------------------------
if ! aws dynamodb describe-table --table-name $TABLE --region $R >/dev/null 2>&1; then
  aws dynamodb create-table --table-name $TABLE --region $R --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH >/dev/null
  aws dynamodb wait table-exists --table-name $TABLE --region $R
  aws dynamodb update-time-to-live --table-name $TABLE --region $R \
    --time-to-live-specification Enabled=true,AttributeName=ttl >/dev/null
fi
if ! aws s3api head-bucket --bucket $BUCKET 2>/dev/null; then
  aws s3api create-bucket --bucket $BUCKET --region $R --create-bucket-configuration LocationConstraint=$R >/dev/null
  aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi
# Browsers upload straight to S3 with presigned POST forms.
aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration \
  "{\"CORSRules\":[{\"AllowedOrigins\":$ORIGINS,\"AllowedMethods\":[\"POST\"],\"AllowedHeaders\":[\"*\"],\"MaxAgeSeconds\":3600}]}"

# --- lambda ------------------------------------------------------------------
if ! aws iam get-role --role-name $ROLE >/dev/null 2>&1; then
  aws iam create-role --role-name $ROLE --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  NEW_ROLE=1
fi
aws iam put-role-policy --role-name $ROLE --policy-name submissions --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
 {\"Effect\":\"Allow\",\"Action\":[\"dynamodb:PutItem\",\"dynamodb:UpdateItem\"],\"Resource\":\"arn:aws:dynamodb:$R:$ACCOUNT:table/$TABLE\"},
 {\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/submissions/*\"},
 {\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"*\"}]}"
[ -n "${NEW_ROLE:-}" ] && sleep 12  # new roles take a moment to propagate

ZIP=$(mktemp -d)/fn.zip
zip -qj "$ZIP" submit.py
if aws lambda get-function --function-name $NAME --region $R >/dev/null 2>&1; then
  aws lambda update-function-code --function-name $NAME --region $R --zip-file "fileb://$ZIP" >/dev/null
else
  aws lambda create-function --function-name $NAME --region $R --runtime python3.12 --handler submit.handler \
    --timeout 10 --memory-size 256 --role "arn:aws:iam::$ACCOUNT:role/$ROLE" --zip-file "fileb://$ZIP" \
    --environment "Variables={TABLE=$TABLE,BUCKET=$BUCKET}" >/dev/null
  aws lambda wait function-active --function-name $NAME --region $R
fi

# --- http api ----------------------------------------------------------------
API=$(aws apigatewayv2 get-apis --region $R --query "Items[?Name=='$NAME'].ApiId" --output text)
if [ -z "$API" ]; then
  API=$(aws apigatewayv2 create-api --region $R --name $NAME --protocol-type HTTP --query ApiId --output text)
  INT=$(aws apigatewayv2 create-integration --region $R --api-id $API --integration-type AWS_PROXY \
    --integration-uri "arn:aws:lambda:$R:$ACCOUNT:function:$NAME" --payload-format-version 2.0 \
    --query IntegrationId --output text)
  aws apigatewayv2 create-route --region $R --api-id $API --route-key 'POST /api/submissions' --target "integrations/$INT" >/dev/null
  aws apigatewayv2 create-stage --region $R --api-id $API --stage-name '$default' --auto-deploy \
    --default-route-settings ThrottlingRateLimit=5,ThrottlingBurstLimit=10 >/dev/null
  aws lambda add-permission --region $R --function-name $NAME --statement-id apigw --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$R:$ACCOUNT:$API/*" >/dev/null
fi
API_HOST="$API.execute-api.$R.amazonaws.com"
echo "API: https://$API_HOST/api/submissions"

# --- cloudfront: /api/* -> API Gateway ----------------------------------------
# Forward only what the API needs. Not Host (API Gateway rejects a foreign Host);
# CloudFront-Viewer-Address gives the Lambda the real visitor IP for rate limiting.
ORP=$(aws cloudfront list-origin-request-policies --type custom \
  --query "OriginRequestPolicyList.Items[?OriginRequestPolicy.OriginRequestPolicyConfig.Name=='$NAME'].OriginRequestPolicy.Id" --output text)
if [ -z "$ORP" ] || [ "$ORP" = "None" ]; then
  ORP=$(aws cloudfront create-origin-request-policy --origin-request-policy-config "{
    \"Name\":\"$NAME\",\"Comment\":\"Better San Jose API\",
    \"HeadersConfig\":{\"HeaderBehavior\":\"whitelist\",\"Headers\":{\"Quantity\":3,\"Items\":[\"CloudFront-Viewer-Address\",\"User-Agent\",\"Content-Type\"]}},
    \"CookiesConfig\":{\"CookieBehavior\":\"none\"},\"QueryStringsConfig\":{\"QueryStringBehavior\":\"none\"}}" \
    --query OriginRequestPolicy.Id --output text)
fi
CFG=$(mktemp)
aws cloudfront get-distribution-config --id $DIST > "$CFG"
ETAG=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['ETag'])" "$CFG")
python3 - "$CFG" "$API_HOST" "$ORP" <<'EOF'
import json, sys
path, host, orp = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(path))['DistributionConfig']
if not any(o['Id'] == 'api' for o in d['Origins']['Items']):
    d['Origins']['Items'].append({
        'Id': 'api', 'DomainName': host, 'OriginPath': '',
        'CustomHeaders': {'Quantity': 0},
        'CustomOriginConfig': {'HTTPPort': 80, 'HTTPSPort': 443, 'OriginProtocolPolicy': 'https-only',
                               'OriginSslProtocols': {'Quantity': 1, 'Items': ['TLSv1.2']},
                               'OriginReadTimeout': 30, 'OriginKeepaliveTimeout': 5},
        'ConnectionAttempts': 3, 'ConnectionTimeout': 10,
        'OriginShield': {'Enabled': False}, 'OriginAccessControlId': '',
    })
    d['Origins']['Quantity'] += 1
cb = d.setdefault('CacheBehaviors', {'Quantity': 0})
items = cb.setdefault('Items', [])
if not any(b['PathPattern'] == '/api/*' for b in items):
    items.append({
        'PathPattern': '/api/*', 'TargetOriginId': 'api', 'ViewerProtocolPolicy': 'https-only',
        'AllowedMethods': {'Quantity': 7, 'Items': ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
                           'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']}},
        'Compress': True, 'SmoothStreaming': False, 'FieldLevelEncryptionId': '',
        'CachePolicyId': '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',          # CachingDisabled
        'OriginRequestPolicyId': orp,
        'LambdaFunctionAssociations': {'Quantity': 0}, 'FunctionAssociations': {'Quantity': 0},
        'TrustedSigners': {'Enabled': False, 'Quantity': 0}, 'TrustedKeyGroups': {'Enabled': False, 'Quantity': 0},
    })
    cb['Quantity'] = len(items)
json.dump(d, open(path + '.new', 'w'))
EOF
aws cloudfront update-distribution --id $DIST --if-match "$ETAG" --distribution-config "file://$CFG.new" \
  --query Distribution.Status --output text
echo "Done. Note: CloudFront maps 403/404 to index.html site-wide, so the API never returns those codes."
