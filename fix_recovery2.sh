#!/bin/bash
set -e
perl -0777 -pe "s|const token = hash.get\\('access_token'\\) \\|\\| qs.get\\('access_token'\\)|const token = hash.get('access_token') || qs.get('access_token') || new URLSearchParams(window.location.search).get('access_token')|" -i pages/auth.tsx
