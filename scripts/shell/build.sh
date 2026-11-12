#!/bin/bash
set -euo pipefail

#
# Project paths
#
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIRECTORY"
mkdir -p ./../../dist/source

#
# Scoped JavaScript version
#
google-closure-compiler \
--language_in ECMASCRIPT5_STRICT \
--language_out ECMASCRIPT5_STRICT \
--warning_level VERBOSE \
--summary_detail_level 3 \
--compilation_level SIMPLE_OPTIMIZATIONS \
--isolation_mode IIFE \
--js "./../../src/scope/Manifest.js" \
--js "./../../src/util/Validation.js" \
--js "./../../src/util/Color.js" \
--js "./../../src/util/Math.js" \
--js "./../../src/util/DirectionalNavigation.js" \
--js "./../../src/util/ViewportScroll.js" \
--js "./../../src/system/config/Values.js" \
--js "./../../src/system/config/Validation.js" \
--js "./../../src/system/Config.js" \
--js "./../../src/util/Paths.js" \
--js "./../../src/util/ResourceBase.js" \
--js "./../../src/text/Typography.js" \
--js "./../../src/text/FontLoader.js" \
--js "./../../src/text/TextScroll.js" \
--js "./../../src/util/EventBindings.js" \
--js "./../../src/util/FileLoader.js" \
--js "./../../src/input/keyboard/KeyboardKey.js" \
--js "./../../src/input/keyboard/KeyboardOptions.js" \
--js "./../../src/input/keyboard/Keyboard.js" \
--js "./../../src/input/gamepad/Gamepad.js" \
--js "./../../src/input/gamepad/Gamepads.js" \
--js "./../../src/input/Inputs.js" \
--js "./../../src/input/Activity.js" \
--js "./../../src/display/Canvas.js" \
--js "./../../src/display/CanvasRegion.js" \
--js "./../../src/display/DisplayObject.js" \
--js "./../../src/display/DisplayObjectContainer.js" \
--js "./../../src/display/DisplayGroup.js" \
--js "./../../src/display/Stage.js" \
--js "./../../src/display/Screen.js" \
--js "./../../src/camera/Camera.js" \
--js "./../../src/tween/transition/Linear.js" \
--js "./../../src/tween/transition/Quad.js" \
--js "./../../src/tween/transition/Sine.js" \
--js "./../../src/tween/TweenValue.js" \
--js "./../../src/tween/Tween.js" \
--js "./../../src/tween/Tweens.js" \
--js "./../../src/media/sound/Sound.js" \
--js "./../../src/media/sound/SoundChannel.js" \
--js "./../../src/media/sound/Sounds.js" \
--js "./../../src/scene/Scene.js" \
--js "./../../src/scene/Scenes.js" \
--js "./../../src/application/ApplicationLog.js" \
--js "./../../src/application/ApplicationIdle.js" \
--js "./../../src/ui/GameMessage.js" \
--js "./../../src/ui/ExitHint.js" \
--js "./../../src/scene/type/Application.js" \
--js "./../../src/scene/type/Screensaver.js" \
--js "./../../src/text/TextField.js" \
--js "./../../src/ui/tilemap/TilemapOptions.js" \
--js "./../../src/ui/tilemap/TileLabels.js" \
--js "./../../src/ui/tilemap/TileAtlas.js" \
--js "./../../src/ui/tilemap/Tile.js" \
--js "./../../src/ui/tilemap/TileLayout.js" \
--js "./../../src/ui/tilemap/Tilemap.js" \
--js "./../../src/ui/tilemap/TilemapTransitions.js" \
--js "./../../src/ui/tilemap/Tilemaps.js" \
--js "./../../src/ui/CategoryHeader.js" \
--js "./../../src/ui/ScreenDimmer.js" \
--js "./../../src/ui/ScreenFade.js" \
--js "./../../src/ui/LauncherBackground.js" \
--js "./../../src/ui/HoldIndicator.js" \
--js "./../../src/ui/notification/Notification.js" \
--js "./../../src/catalog/GameRegistry.js" \
--js "./../../src/catalog/GameAvailability.js" \
--js "./../../src/catalog/ScreensaverRegistry.js" \
--js "./../../src/catalog/TagRegistry.js" \
--js "./../../src/catalog/CategoryValidation.js" \
--js "./../../src/catalog/CategoryRegistry.js" \
--js "./../../src/catalog/CategoryEngine.js" \
--js "./../../src/catalog/CategorySelection.js" \
--js "./../../src/library/Library.js" \
--js "./../../src/library/ContentInspector.js" \
--js "./../../src/library/ScreensaverLibrary.js" \
--js "./../../src/library/ContentFolders.js" \
--js "./../../src/library/LocalLibrary.js" \
--js "./../../src/launcher/GameTilePriority.js" \
--js "./../../src/launcher/MatchExplanation.js" \
--js "./../../src/launcher/GamePresentation.js" \
--js "./../../src/launcher/CategoryTilemapManager.js" \
--js "./../../src/application/ApplicationLauncher.js" \
--js "./../../src/application/ScreensaverRotation.js" \
--js "./../../src/launcher/LibraryRefresh.js" \
--js "./../../src/launcher/LibraryStatus.js" \
--js "./../../src/launcher/LauncherIdle.js" \
--js "./../../src/scene/type/Launcher.js" \
--js "./../../src/ui/BootLogo.js" \
--js "./../../src/scene/type/Boot.js" \
--js "./../../src/sync/SyncOperation.js" \
--js "./../../src/sync/SyncProvider.js" \
--js "./../../src/sync/ApiSyncProvider.js" \
--js "./../../src/sync/LibrarySync.js" \
--js "./../../src/system/Main.js" \
--js "./../../src/system/Startup.js" \
--js "./../../src/scope/Alias.js" \
--js_output_file "./../../dist/source/runeos.js"
