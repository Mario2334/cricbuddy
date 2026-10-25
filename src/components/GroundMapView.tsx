import React, { memo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import type { Ground } from '../types/Ground';
import googleMapsService from '../services/googleMapsService';
import { colors, curve, glass, palette, radii, shadows, space } from '../theme';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { IconTile } from '../ui/IconTile';

interface GroundMapViewProps {
  ground: Ground;
  showSearchButton?: boolean;
}


const GroundMapView: React.FC<GroundMapViewProps> = ({
  ground,
  showSearchButton = true
}) => {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  // CHANGED: no permission prompt (and no fresh GPS fix) every time a match opens.
  // If location is already allowed, use the last known position; otherwise ask
  // only when the user taps Directions.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (!mounted || status !== 'granted') return;
        setLocationPermission(true);
        const last = await Location.getLastKnownPositionAsync();
        if (mounted && last) setUserLocation(last);
      } catch (error) {
        console.error('Error reading location permission:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const locateUser = async (): Promise<Location.LocationObject | null> => {
    if (userLocation) return userLocation;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      setLocationPermission(true);
      const location =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setUserLocation(location);
      return location;
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const openInGoogleMaps = () => {
    const latitude = parseFloat(ground.latitude);
    const longitude = parseFloat(ground.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      // Fallback to search by name if coordinates are invalid
      searchGroundByName();
      return;
    }

    const url = Platform.select({
      ios: `comgooglemaps://?q=${latitude},${longitude}&center=${latitude},${longitude}&zoom=14`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(ground.name)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    });

    Linking.canOpenURL(url!).then(supported => {
      if (supported) {
        Linking.openURL(url!);
      } else {
        // Fallback to web Google Maps with normalization
        const webUrl = googleMapsService.normalizeGoogleMapsUrl(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
        Linking.openURL(webUrl);
      }
    }).catch(() => {
      searchGroundByName();
    });
  };

  const searchGroundByName = () => {
    // Search by ground name and city as fallback when coordinates don't work
    const searchQuery = `${ground.name} ${ground.city_name}`;
    const url = Platform.select({
      ios: `comgooglemaps://?q=${encodeURIComponent(searchQuery)}`,
      android: `geo:0,0?q=${encodeURIComponent(searchQuery)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`
    });

    Linking.canOpenURL(url!).then(supported => {
      if (supported) {
        Linking.openURL(url!);
      } else {
        // Final fallback to web Google Maps with normalization
        const webUrl = googleMapsService.normalizeGoogleMapsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`);
        Linking.openURL(webUrl);
      }
    }).catch(error => {
      Alert.alert('Error', 'Unable to open maps application');
      console.error('Error opening maps:', error);
    });
  };

  const getDirections = async () => {
    const userLocation = await locateUser();
    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location services to get directions.');
      return;
    }

    const latitude = parseFloat(ground.latitude);
    const longitude = parseFloat(ground.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      Alert.alert('Invalid Coordinates', 'Ground coordinates are not available for directions.');
      return;
    }

    const url = Platform.select({
      ios: `comgooglemaps://?saddr=${userLocation.coords.latitude},${userLocation.coords.longitude}&daddr=${latitude},${longitude}&directionsmode=driving`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&origin=${userLocation.coords.latitude},${userLocation.coords.longitude}&destination=${latitude},${longitude}`
    });

    Linking.canOpenURL(url!).then(supported => {
      if (supported) {
        Linking.openURL(url!);
      } else {
        // Fallback to web Google Maps directions with normalization
        const webUrl = googleMapsService.normalizeGoogleMapsUrl(`https://www.google.com/maps/dir/?api=1&origin=${userLocation.coords.latitude},${userLocation.coords.longitude}&destination=${latitude},${longitude}`);
        Linking.openURL(webUrl);
      }
    }).catch(error => {
      Alert.alert('Error', 'Unable to open navigation');
      console.error('Error opening navigation:', error);
    });
  };

  // Parse coordinates
  const latitude = parseFloat(ground.latitude);
  const longitude = parseFloat(ground.longitude);
  const hasValidCoordinates = !isNaN(latitude) && !isNaN(longitude);

  if (!hasValidCoordinates) {
    return (
      <View style={styles.container}>
        <View style={[styles.noMapContainer, curve]}>
          <IconTile icon="map" tone="teal" size="lg" style={styles.noMapIcon} />
          <AppText variant="h3" center>Map not available</AppText>
          <AppText variant="small" color={colors.textMuted} center style={styles.noMapSubtext}>
            Invalid coordinates for this ground
          </AppText>
          {showSearchButton && (
            <Button
              label="Search in Google Maps"
              icon="search"
              variant="secondary"
              size="sm"
              onPress={searchGroundByName}
            />
          )}
        </View>
      </View>
    );
  }

  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };


  return (
    <View style={styles.container}>
      <View style={[styles.mapFrame, curve]}>
        <View style={[styles.mapClip, curve]}>
          {/* initialRegion (keyed on the spot): a controlled region re-centred the map on every parent render. */}
          <MapView
            key={`${latitude},${longitude}`}
            style={styles.map}
            provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
            initialRegion={region}
            showsUserLocation={locationPermission}
            showsMyLocationButton={locationPermission}
            showsCompass={true}
            showsScale={true}
          >
            <Marker
              coordinate={{ latitude, longitude }}
              title={ground.name}
              description={`${ground.city_name}${ground.address ? ` - ${ground.address}` : ''}`}
              pinColor={palette.green600}
            />
          </MapView>
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.mapRim, curve]} />
      </View>

      <View style={styles.buttonContainer}>
        {showSearchButton && (
          <Button
            label="Open in Maps"
            icon="map"
            variant="primary"
            size="sm"
            onPress={openInGoogleMaps}
            style={styles.buttonFlex}
          />
        )}
        <Button
          label="Directions"
          icon="directions"
          variant="sunny"
          size="sm"
          onPress={getDirections}
          style={styles.buttonFlex}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  mapFrame: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    backgroundColor: palette.green50,
    ...shadows.glass,
  },
  mapClip: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  mapRim: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: glass.rim,
  },
  map: {
    width: '100%',
    height: 220,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  buttonFlex: {
    flex: 1,
  },
  noMapContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.stone300,
    backgroundColor: glass.fill,
  },
  noMapIcon: {
    marginBottom: space.md,
  },
  noMapSubtext: {
    marginTop: space.xxs,
    marginBottom: space.md,
  },
});

export default memo(GroundMapView);
