#!/bin/bash
set -e
perl -0777 -pe "s/const \[tab, setTab\] = useState<'signin'\|'signup'\|'reset'>\('signin'\)/const [tab, setTab] = useState<'signin'|'signup'|'reset'>((typeof window!=='undefined' && window.location.hash.includes('recovery')) ? 'reset' : 'signin')/" -i pages/auth.tsx
