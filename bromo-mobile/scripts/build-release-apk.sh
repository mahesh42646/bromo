#!/usr/bin/env bash
# Release APK: minSdk 29 (Android 10) → targetSdk 36. Use JDK 21 for Gradle — JDK 25 breaks Prefab/RN CMake.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/android"

pick_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    local v
    v="$("${JAVA_HOME}/bin/java" -version 2>&1 | head -1 || true)"
    if [[ "$v" == *"21."* ]] || [[ "$v" == *"\"17."* ]]; then
      echo "$JAVA_HOME"
      return
    fi
  fi
  for candidate in \
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "$HOME/.sdkman/candidates/java/21.0.11-tem" \
    "${ANDROID_STUDIO_JDK:-}"; do
    if [[ -n "$candidate" && -x "$candidate/bin/java" ]]; then
      echo "$candidate"
      return
    fi
  done
  for studio in \
    "$HOME/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
    if [[ -x "$studio/bin/java" ]]; then
      echo "$studio"
      return
    fi
  done
  echo ""
}

JH="$(pick_java_home)"
if [[ -z "$JH" ]]; then
  echo "Need JDK 21 (or 17) for JAVA_HOME. Install: brew install openjdk@21" >&2
  exit 1
fi
export JAVA_HOME="$JH"
echo "Using JAVA_HOME=$JAVA_HOME"
./gradlew assembleRelease "$@"

echo "APK: $ROOT/android/app/build/outputs/apk/release/app-release.apk"
