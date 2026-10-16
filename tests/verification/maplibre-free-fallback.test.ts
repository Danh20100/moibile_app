import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (name: string): string => readFileSync(name, 'utf8');

test('MapLibre/OpenFreeMap is free-mode default without Google API key or billing', () => {
  const env = read('.env.example');
  assert.match(env, /^TROOI_MAP_PROVIDER=maplibre$/m);
  assert.match(env, /^TROOI_MAPLIBRE_STYLE_URL=https:\/\/tiles\.openfreemap\.org\/styles\/liberty$/m);
  const gradle = read('app/build.gradle.kts');
  assert.match(gradle, /org\.maplibre\.gl:android-sdk-opengl:11\.8\.3/);
  assert.match(gradle, /buildConfigField\("String", "MAP_PROVIDER"/);
  assert.match(gradle, /buildConfigField\("String", "MAPLIBRE_STYLE_URL"/);
  const policy = read('app/src/main/java/com/trooi/app/features/discovery/MapProviderPolicy.kt');
  assert.match(policy, /"google" -> if \(googleApiKey\.isNotBlank\(\)\)/);
  assert.match(policy, /else -> MapProvider\.MAPLIBRE/);
  assert.doesNotMatch(policy, /tile\.openstreetmap\.org|mapbox\.com/);
});

test('shared Guest/Owner map supports marker click, camera search, picker and free attribution', () => {
  const wrapper = read('app/src/main/java/com/trooi/app/features/discovery/FallbackMapView.kt');
  const native = read('app/src/main/java/com/trooi/app/features/discovery/MapLibreNativeView.kt');
  const google = read('app/src/main/java/com/trooi/app/features/discovery/NativeMapView.kt');
  assert.match(wrapper, /fun NativeMapView\(/);
  assert.match(wrapper, /MapLibreNativeView\(/);
  assert.match(wrapper, /GoogleNativeMapView\(/);
  assert.match(wrapper, /map-switch-provider/);
  assert.match(wrapper, /© OpenStreetMap contributors · OpenFreeMap/);
  for (const param of ['publicMarkers', 'selectedPoint', 'onCameraCenter', 'onMarkerListing', 'onPick']) {
    assert.match(wrapper, new RegExp(param + ' = ' + param));
  }
  assert.match(native, /publicMapMarkers\(publicMarkers\)/);
  assert.match(native, /publicMapPoint\(listing\)/);
  assert.match(native, /addOnCameraIdleListener/);
  assert.match(native, /addOnMapClickListener/);
  assert.match(native, /setOnMarkerClickListener/);
  assert.doesNotMatch(native, /privateGeoPoint|privateLocation\.point/);
  assert.match(google, /internal fun GoogleNativeMapView\(/);
  const screens = read('app/src/main/java/com/trooi/app/features/tenant/GuestPovScreens.kt');
  assert.match(screens, /NativeMapView\(/);
});

test('README documents free map scope and excludes billing guarantees for third-party tile hosting', () => {
  const readme = read('README.md');
  assert.match(readme, /MapLibre/);
  assert.match(readme, /OpenFreeMap/);
  assert.match(readme, /BSD-2-Clause/);
  assert.match(readme, /https:\/\/openfreemap\.org\/tos\//);
  assert.match(readme, /không.*cam kết.*mãi mãi|không.*bảo đảm.*mãi mãi/i);
});
