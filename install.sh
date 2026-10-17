#!/usr/bin/env bash
# One-command macOS/Linux bootstrap; Node, Python and Git are not prerequisites.
set -euo pipefail

aziz_root="${AZIZ_WA_HOME:-${HOME}/.local/share/aziz-wa}"
aziz_agent=both
aziz_source=""
aziz_shortcut=yes
aziz_plan=no
while [ "$#" -gt 0 ]; do
  case "$1" in
    --home|--agent|--source)
      [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }
      case "$1" in --home) aziz_root=$2;; --agent) aziz_agent=$2;; --source) aziz_source=$2;; esac
      shift 2;;
    --no-shortcut) aziz_shortcut=no; shift;;
    --plan) aziz_plan=yes; shift;;
    --help) echo 'Usage: install.sh [--agent both|claude|codex] [--home DIR] [--no-shortcut] [--plan]'; exit 0;;
    *) echo "Unknown option: $1" >&2; exit 2;;
  esac
done
case "$aziz_agent" in both|claude|codex) ;; *) echo 'Choose both, claude, or codex.' >&2; exit 2;; esac
case "$aziz_root" in /*) ;; *) echo '--home must be an absolute path.' >&2; exit 2;; esac
[ "$aziz_root" != / ] && [ "$aziz_root" != "$HOME" ] || { echo 'Use a dedicated installation folder.' >&2; exit 2; }
case "$(uname -s)" in Darwin) aziz_os=darwin;; Linux) aziz_os=linux;; *) echo 'Use install.ps1 on Windows.' >&2; exit 2;; esac
case "$(uname -m)" in arm64|aarch64) aziz_arch=arm64;; x86_64|amd64) aziz_arch=x64;; *) echo 'This installer supports x64 and ARM64.' >&2; exit 2;; esac
if [ "$aziz_os" = linux ] && [ -f /etc/alpine-release ]; then
  echo 'Portable Node/Chromium setup requires a supported glibc Linux distribution (Ubuntu/Debian), not Alpine.' >&2; exit 2
fi
if [ "$aziz_plan" = yes ]; then
  printf 'Platform: %s-%s\nInstallation: %s\nAgents: %s\n' "$aziz_os" "$aziz_arch" "$aziz_root" "$aziz_agent"
  echo 'Install verified Node.js 24 LTS, managed Python, browser/audit tools, chosen agents, skill and launcher; run doctor.'
  exit 0
fi
command -v tar >/dev/null || { echo 'The operating system tar utility is required.' >&2; exit 2; }
aziz_fetch() {
  if command -v curl >/dev/null; then curl --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 600 "$1" -o "$2"
  elif command -v wget >/dev/null; then wget -q --timeout=30 --tries=3 -O "$2" "$1"
  else echo 'Use the download-and-run option in the README: this OS has neither curl nor wget.' >&2; return 1; fi
}
mkdir -p "$aziz_root/runtime" "$aziz_root/tmp"
aziz_tmp=$(mktemp -d "$aziz_root/tmp/bootstrap.XXXXXXXX")
trap 'rm -rf "$aziz_tmp"' EXIT
aziz_node_root="$aziz_root/runtime/node"
aziz_node="$aziz_node_root/bin/node"
if ! [ -x "$aziz_node" ] || ! "$aziz_node" -e 'process.exit(Number(process.versions.node.split(".")[0])===24?0:1)' 2>/dev/null; then
  echo 'Installing a private Node.js 24 LTS runtime...'
  aziz_base=https://nodejs.org/dist/latest-v24.x
  aziz_fetch "$aziz_base/SHASUMS256.txt" "$aziz_tmp/SHASUMS256.txt"
  aziz_file=$(awk -v suffix="-${aziz_os}-${aziz_arch}.tar.gz" '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-/ && substr($2,length($2)-length(suffix)+1)==suffix {print $2; exit}' "$aziz_tmp/SHASUMS256.txt")
  [ -n "$aziz_file" ] || { echo 'No supported Node archive found.' >&2; exit 1; }
  aziz_expected=$(awk -v name="$aziz_file" '$2==name {print $1}' "$aziz_tmp/SHASUMS256.txt")
  aziz_fetch "$aziz_base/$aziz_file" "$aziz_tmp/$aziz_file"
  if command -v shasum >/dev/null; then aziz_actual=$(shasum -a 256 "$aziz_tmp/$aziz_file" | awk '{print $1}')
  elif command -v sha256sum >/dev/null; then aziz_actual=$(sha256sum "$aziz_tmp/$aziz_file" | awk '{print $1}')
  else echo 'A system SHA-256 utility is required; refusing an unchecked runtime.' >&2; exit 1; fi
  [ "$aziz_expected" = "$aziz_actual" ] || { echo 'Node.js checksum mismatch; installation stopped.' >&2; exit 1; }
  mkdir "$aziz_tmp/node"
  tar -xzf "$aziz_tmp/$aziz_file" -C "$aziz_tmp/node" --strip-components=1
  if [ -e "$aziz_node_root" ]; then mv "$aziz_node_root" "$aziz_root/runtime/node.backup.$(date +%s).$$"; fi
  mv "$aziz_tmp/node" "$aziz_node_root"
fi
if [ -z "$aziz_source" ]; then
  echo 'Downloading aziz-WA from VercaaLLC/aziz...'
  aziz_fetch https://codeload.github.com/VercaaLLC/aziz/tar.gz/refs/heads/main "$aziz_tmp/skill.tar.gz"
  mkdir "$aziz_tmp/source"
  tar -xzf "$aziz_tmp/skill.tar.gz" -C "$aziz_tmp/source" --strip-components=1
  aziz_source="$aziz_tmp/source"
fi
[ -f "$aziz_source/SKILL.md" ] && [ -f "$aziz_source/scripts/setup.mjs" ] || { echo 'The downloaded skill is incomplete.' >&2; exit 1; }
export AZIZ_WA_HOME="$aziz_root"
export PATH="$aziz_node_root/bin:$PATH"
aziz_args=(--home "$aziz_root" --node-root "$aziz_node_root" --agent "$aziz_agent")
if [ "$aziz_shortcut" = no ]; then aziz_args+=(--no-shortcut); fi
"$aziz_node" "$aziz_source/scripts/setup.mjs" "${aziz_args[@]}"
