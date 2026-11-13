import React from 'react';
import { View, Linking } from 'react-native';
import type { Ground } from '../types/Ground';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
export default function GroundMapView({ground}: {ground: Ground; showSearchButton?: boolean}) {
  const lat = Number.parseFloat(ground.latitude), lon = Number.parseFloat(ground.longitude);
  const valid = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180;
  const query = valid ? `${lat},${lon}` : ground.name;
  return <View style={{gap:12}}>
    {valid ? React.createElement('iframe', {title:'Ground map — OpenStreetMap',loading:'lazy',src:`https://www.openstreetmap.org/export/embed.html?bbox=${lon-.015},${lat-.01},${lon+.015},${lat+.01}&layer=mapnik&marker=${lat},${lon}`,style:{width:'100%',height:240,border:0,borderRadius:16}}) : <AppText>Search for this ground using its name.</AppText>}
    <AppText>Maps require a connection. © OpenStreetMap contributors</AppText>
    <Button label="View in Google Maps" onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query))} />
    <Button label="Directions" onPress={() => Linking.openURL('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(query))} />
  </View>;
}
