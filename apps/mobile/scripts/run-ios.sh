#!/bin/sh

set -eu

if pod --version >/dev/null 2>&1; then
  exec expo run:ios "$@"
fi

for chromawave_pod in "$HOME"/.rvm/gems/*/bin/pod; do
  if [ -x "$chromawave_pod" ] && "$chromawave_pod" --version >/dev/null 2>&1; then
    CHROMAWAVE_POD_DIR=$(dirname "$chromawave_pod")
    export PATH="$CHROMAWAVE_POD_DIR:$PATH"
    exec expo run:ios "$@"
  fi
done

echo "Chroma Wave could not find a working CocoaPods executable." >&2
echo "Install CocoaPods for the active Ruby, then rerun this command." >&2
exit 1
