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

  /**
   * Normalizes Google Maps URLs to ensure they work properly
   * Converts shortened URLs and problematic formats to standard formats
   */
  normalizeGoogleMapsUrl(url: string): string {
    if (!url) return url;

    // Handle shortened Google Maps URLs (maps.app.goo.gl, goo.gl/maps, etc.)
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps') || url.includes('g.co/maps')) {
      // For shortened URLs, we can't easily extract the place_id or coordinates
      // So we'll return a generic search URL that should work
      console.warn('Shortened Google Maps URL detected, using fallback format:', url);
      return 'https://www.google.com/maps/';
    }

    // Handle old problematic formats and convert to proper format
    if (url.includes('maps.google.com/maps/place/?q=place_id:')) {
      const placeIdMatch = url.match(/place_id:([^&]+)/);
      if (placeIdMatch) {
        return `https://www.google.com/maps/place/?q=place_id:${placeIdMatch[1]}`;
      }
    }

    // Handle coordinate-based URLs
    if (url.includes('maps.google.com/?q=') && url.match(/q=[-\d.]+,[-\d.]+/)) {
      const coordMatch = url.match(/q=([-\d.]+,[-\d.]+)/);
      if (coordMatch) {
        return `https://www.google.com/maps/search/?api=1&query=${coordMatch[1]}`;
      }
    }

    // If it's already a proper Google Maps URL, return as is
    if (url.includes('www.google.com/maps') || url.includes('maps.google.com')) {
      return url;
    }

    // For any other format, return as is but log a warning
    console.warn('Unknown Google Maps URL format:', url);
    return url;
  }
}

export default new GoogleMapsService();
