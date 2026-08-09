#!/bin/bash
# Splice the built .txz (base64) into cannonadecommand.plg's txz FILE stanza
# (Name="&plgPath;/&txz;" Type="base64"), replacing whatever is currently
# between its <INLINE> and </INLINE> tags - the @@TXZ_BASE64@@ placeholder on
# a fresh checkout, or a prior release's blob.
#
#   plugin/embed_txz.sh <VERSION>
#
# Run AFTER plugin/pkg_build.sh <VERSION>. Boot-time reinstall (Unraid's rc.local,
# very early, before network is reliable) then needs zero network - see the
# comment above the FILE stanza in cannonadecommand.plg for why.
#
# IMPORTANT: Type="base64" belongs on the <FILE> tag, NOT the nested <INLINE>
# tag - dynamix.plugin.manager's plugin script reads $file->attributes()->Type
# off the FILE element. Type="base64" on <INLINE> is silently ignored (no
# error), so the raw base64 TEXT gets written as the "txz" instead of being
# decoded first - proven live via an instrumented copy of the real plugin
# script (v3.6.4, "xz: file format not recognized" on Bottich).
set -euo pipefail

VERSION="${1:?usage: embed_txz.sh <VERSION>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLG="$ROOT/plugin/cannonadecommand.plg"
TXZ="$ROOT/plugin/out/cannonadecommand-$VERSION-x86_64-1.txz"

[ -f "$TXZ" ] || { echo "missing $TXZ - run pkg_build.sh $VERSION first" >&2; exit 1; }

FILE_LINE=$(grep -n '<FILE Name="&plgPath;/&txz;"' "$PLG" | head -1 | cut -d: -f1)
[ -n "$FILE_LINE" ] || { echo "no txz FILE stanza found in $PLG" >&2; exit 1; }
grep -q 'Type="base64"' <(sed -n "${FILE_LINE}p" "$PLG") || { echo "txz FILE stanza is missing Type=\"base64\" (must be on <FILE>, not <INLINE>) in $PLG" >&2; exit 1; }
OPEN=$(awk -v start="$FILE_LINE" 'NR>=start && /<INLINE>/{print NR; exit}' "$PLG")
[ -n "$OPEN" ] || { echo "no <INLINE> tag found after the txz FILE stanza (line $FILE_LINE) in $PLG" >&2; exit 1; }
CLOSE=$(awk -v start="$OPEN" 'NR>start && /<\/INLINE>/{print NR; exit}' "$PLG")
[ -n "$CLOSE" ] || { echo "no matching </INLINE> found after line $OPEN in $PLG" >&2; exit 1; }

echo "==> encoding $(basename "$TXZ") ($(wc -c < "$TXZ") bytes) as base64"
TMP="$(mktemp)"
head -n "$OPEN" "$PLG" > "$TMP"
base64 -w0 "$TXZ" >> "$TMP"
echo >> "$TMP"
tail -n "+$CLOSE" "$PLG" >> "$TMP"
mv "$TMP" "$PLG"

echo "==> verifying: decode embedded blob back out and compare sha256"
DECODED="$(mktemp)"
NEW_OPEN=$(awk -v start="$FILE_LINE" 'NR>=start && /<INLINE>/{print NR; exit}' "$PLG")
NEW_CLOSE=$(awk -v start="$NEW_OPEN" 'NR>start && /<\/INLINE>/{print NR; exit}' "$PLG")
sed -n "$((NEW_OPEN+1)),$((NEW_CLOSE-1))p" "$PLG" | base64 -d > "$DECODED"
SRC_SHA=$(sha256sum "$TXZ" | cut -d' ' -f1)
DEC_SHA=$(sha256sum "$DECODED" | cut -d' ' -f1)
rm -f "$DECODED"
if [ "$SRC_SHA" != "$DEC_SHA" ]; then
  echo "MISMATCH: embedded blob does not decode back to the built txz ($SRC_SHA vs $DEC_SHA)" >&2
  exit 1
fi
echo "==> embedded + verified: $(basename "$TXZ") -> $PLG (sha256 $SRC_SHA)"
echo "==> $(wc -c < "$PLG") bytes total"
