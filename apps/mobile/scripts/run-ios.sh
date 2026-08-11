#!/bin/sh

set -eu

# The workspace's own Expo CLI, never whatever `expo` resolves to on PATH.
#
# A globally installed `expo-cli` — the deprecated package, superseded by the
# `expo` bin that ships inside the project — shadows the local one and takes
# over. It builds the native app successfully and then fails on the dev server
# with "Missing package metro in the project", which reads like a broken
# dependency tree and is nothing of the kind. Worse, the failure happens *after*
# the build, so the app is compiled but never installed, and the simulator keeps
# running whatever stale binary it already had.
#
# `node_modules/.bin` is prepended rather than the binary being invoked directly
# so that any tool the CLI shells out to also resolves locally.
CHROMAWAVE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
PATH="$CHROMAWAVE_ROOT/node_modules/.bin:$PATH"
export PATH

if pod --version >/dev/null 2>&1; then
  exec expo run:ios "$@"
fi

for chromawave_pod in "$HOME"/.rvm/gems/*/bin/pod; do
  if [ -x "$chromawave_pod" ] && "$chromawave_pod" --version >/dev/null 2>&1; then
    CHROMAWAVE_POD_DIR=$(dirname "$chromawave_pod")
    PATH="$CHROMAWAVE_POD_DIR:$PATH"
    export PATH
    exec expo run:ios "$@"
  fi
done

echo "Chroma Wave could not find a working CocoaPods executable." >&2
echo "Install CocoaPods for the active Ruby, then rerun this command." >&2
exit 1
