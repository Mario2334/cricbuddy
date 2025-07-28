import Constants from 'expo-constants';

export interface GoogleMapsPlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
}

export interface GoogleMapsSearchResponse {
  results: GoogleMapsPlace[];
  status: string;
}

class GoogleMapsService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    // Get Google Maps API key from app configuration
    this.apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || 
                  'AIzaSyAd84lRshTbxQhXkjr9ocgh32BnyC1ucoo'; // Fallback to the key from app.json
  }

  async searchPlaces(query: string): Promise<GoogleMapsPlace[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}/textsearch/json?query=${encodedQuery}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data: GoogleMapsSearchResponse = await response.json();

      if (data.status === 'OK') {
        return data.results;
      } else {
        console.error('Google Maps API error:', data.status);
        return [];
      }
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }

  generateMapsUrl(place: GoogleMapsPlace): string {
    return `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
  }

  generateMapsUrlFromCoordinates(lat: number, lng: number): string {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }

  generateMapsUrlFromQuery(query: string): string {
    return `https://maps.google.com/maps/search/${encodeURIComponent(query)}`;
  }
}

export default new GoogleMapsService();
