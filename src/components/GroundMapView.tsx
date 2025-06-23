import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import type { Ground } from '../types/Ground';

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

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location);
      } else {
        setLocationPermission(false);
        Alert.alert(
          'Location Permission',
          'Location permission is needed to show your position on the map.'
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
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
        // Fallback to web Google Maps
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
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
        // Final fallback to web Google Maps
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
        Linking.openURL(webUrl);
      }
    }).catch(error => {
      Alert.alert('Error', 'Unable to open maps application');
      console.error('Error opening maps:', error);
    });
  };

  const getDirections = () => {
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
        // Fallback to web Google Maps directions
        const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.coords.latitude},${userLocation.coords.longitude}&destination=${latitude},${longitude}`;
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
        <View style={styles.noMapContainer}>
          <Text style={styles.noMapText}>Map not available</Text>
          <Text style={styles.noMapSubtext}>Invalid coordinates for this ground</Text>
          {showSearchButton && (
            <TouchableOpacity style={styles.searchButton} onPress={searchGroundByName}>
              <Text style={styles.searchButtonText}>Search in Google Maps</Text>
            </TouchableOpacity>
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
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={locationPermission}
        showsMyLocationButton={locationPermission}
        showsCompass={true}
        showsScale={true}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={ground.name}
          description={`${ground.city_name}${ground.address ? ` - ${ground.address}` : ''}`}
        />
      </MapView>

      <View style={styles.buttonContainer}>
        {showSearchButton && (
          <TouchableOpacity style={styles.mapButton} onPress={openInGoogleMaps}>
            <Ionicons name="location-outline" size={20} color="#fff" />
            <Text style={styles.mapButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        )}

        {locationPermission && userLocation && (
          <TouchableOpacity style={styles.directionsButton} onPress={getDirections}>
            <Ionicons name="navigate-outline" size={20} color="#fff" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    width: '100%',
    height: 300,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  mapButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  noMapContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    margin: 16,
  },
  noMapText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  noMapSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
    textAlign: 'center',
  },
  directionsButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GroundMapView;
