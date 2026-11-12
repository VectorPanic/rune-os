#!/bin/bash
set -u

#
# Project paths
#
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ERROR_LOG="$SCRIPT_DIRECTORY/../log/build_error.log"
cd "$SCRIPT_DIRECTORY" || exit 1
rm -f "$ERROR_LOG"

STEPS_BEGUN=0
STEPS_PASS=0
START_TIME=$SECONDS
EXIT_CODE=0
COLOR=1
INTERACTIVE=0

if [ -n "${NO_COLOR:-}" ]; then COLOR=0; fi
if [ -t 1 ]; then INTERACTIVE=1; fi

#
# SDK-style colors; NO_COLOR requests plain text
#
print_status() {
    local STATUS="$1"
    local BACKGROUND=43

    case "$STATUS" in
        PASS) BACKGROUND=42 ;;
        FAIL) BACKGROUND=101 ;;
    esac

    if [ "$COLOR" = 1 ];
    then
        if [ "$INTERACTIVE" = 1 ] && { [ "$STATUS" = PASS ] || [ "$STATUS" = FAIL ]; };
        then
            printf '\033[1A\r\033[2K'
        fi
        printf '\033[1m\033[%sm  %s  \033[0m \033[2mBuilding:\033[0m %s' "$BACKGROUND" "$STATUS" "$LABEL"
        if [ "$STEP" = build ]; then printf ' \033[2m(SCOPED)\033[0m'; fi
        printf '\n'
    else
        printf '  %s   Building: %s' "$STATUS" "$LABEL"
        if [ "$STEP" = build ]; then printf ' (SCOPED)'; fi
        printf '\n'
    fi
}

printf '\n'
if [ "$COLOR" = 1 ];
then
    printf '\033[1m[ Make ]\033[0m\033[2m[ Compiling JavaScript (ES5) From Source Files ]\033[0m\n'
else
    printf '[ Make ][ Compiling JavaScript (ES5) From Source Files ]\n'
fi
printf '\n'

#
# Compile source and compose icons
#
for STEP in build compose;
do
    case "$STEP" in
        build)
            LABEL="Rune OS runtime"
            COMMAND=(bash ./build.sh)
            ;;
        compose)
            LABEL="macOS application icon"
            COMMAND=(bash ./compose.sh)
            ;;
    esac

    STEPS_BEGUN=$((STEPS_BEGUN + 1))
    if [ "$EXIT_CODE" != 0 ];
    then
        print_status SKIP
        continue
    fi

    print_status RUNS
    if RESULTS=$("${COMMAND[@]}" 2>&1);
    then
        STEPS_PASS=$((STEPS_PASS + 1))
        print_status PASS
        if [ "$STEP" = build ]; then RESULTS=""; fi
    else
        EXIT_CODE=$?
        print_status FAIL
        mkdir -p "$(dirname -- "$ERROR_LOG")"
        printf '%s\n\n%s\n' "$LABEL" "$RESULTS" > "$ERROR_LOG"
    fi

    if [ -n "$RESULTS" ]; then printf '%s\n' "$RESULTS"; fi
done

#
# Build report
#
ELAPSED_TIME=$((SECONDS - START_TIME))
NUMBER_OF_FILES=$(grep -c '^--js ' ./build.sh)

printf '\n'
if [ "$COLOR" = 1 ];
then
    printf '\033[1mNumber of Files:\033[0m\t%s \033[2m(JavaScript)\033[0m\n' "$NUMBER_OF_FILES"
    printf '\033[1mBuild Steps:\033[0m\t\t%s passed, %s total\n' "$STEPS_PASS" "$STEPS_BEGUN"
    printf '\033[1mDuration:\033[0m\t\t%s seconds\n' "$ELAPSED_TIME"
else
    printf 'Number of Files:  %s (JavaScript)\n' "$NUMBER_OF_FILES"
    printf 'Build Steps:      %s passed, %s total\n' "$STEPS_PASS" "$STEPS_BEGUN"
    printf 'Duration:         %s seconds\n' "$ELAPSED_TIME"
fi
printf '\n'

if [ "$EXIT_CODE" = 0 ];
then
    if [ "$COLOR" = 1 ]; then printf '\033[1m\033[92m'; fi
    printf 'Build process finished successfully.\n'
else
    if [ "$COLOR" = 1 ]; then printf '\033[1m\033[91m'; fi
    printf 'Build process finished unsuccessfully.\n'
    printf 'Error log: %s\n' "$ERROR_LOG"
fi
if [ "$COLOR" = 1 ]; then printf '\033[0m'; fi
printf '\n'

exit "$EXIT_CODE"
