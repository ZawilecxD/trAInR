#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?}"
: "${GH_REPO:?}"
: "${PR_NUMBER:?}"

comment_file="${GITHUB_WORKSPACE}/ai-review-comment.md"
marker="<!-- ai-cr:review -->"

ids="$(
  gh api "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" --paginate \
    --jq ".[] | select(.body | contains(\"${marker}\")) | .id"
)"

payload="$(jq -n --rawfile body "$comment_file" '{body: $body}')"

if [[ -z "$ids" ]]; then
  gh api --method POST "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" --input - <<<"$payload"
  exit 0
fi

first=true
while read -r id; do
  [[ -z "$id" ]] && continue
  if $first; then
    gh api --method PATCH "repos/${GH_REPO}/issues/comments/${id}" --input - <<<"$payload"
    first=false
  else
    gh api --method DELETE "repos/${GH_REPO}/issues/comments/${id}"
  fi
done <<<"$ids"
