export interface GroundMedia {
  media: string;
}

export interface GroundCreatorData {
  id: number;
  text: string;
}

export interface Ground {
  ground_id: number;
  name: string;
  logo: string;
  is_ground_logo_enable_for_streaming: number;
  media: GroundMedia[];
  latitude: string;
  longitude: string;
  address: string;
  ground_type: string;
  contact_person_name: string;
  description: string;
  country: string;
  primary_mobile: string;
  secondary_mobile: string;
  price: string;
  city_id: number;
  city_name: string;
  book_ground: number;
  is_news_feed: number;
  created_date: string;
  place_id: string;
  is_promote: number;
  day_price: string;
  night_price: string;
  is_active: number;
  is_publish: number;
  is_sponsored: number;
  sponsored_url: string;
  created_by: number;
  is_partner: number;
  partner_offer: string;
  partnership_start_date: string | null;
  partnership_end_date: string | null;
  creator_display_text: string;
  is_available_for_booking: number;
  is_enable_for_full_slot_booking_default: number;
  booking_app_ground_id: number;
  booking_token_amount_per: number;
  other_facilities: string;
  shortest_boundary_length: number;
  longest_boundary_length: number;
  slot_booking_ball_type: string;
  distance: number;
  partner_help_text: string;
  creator_data: GroundCreatorData[];
  whatsapp_url: string;
  total_views: number;
  rating: number;
  total_rating: number;
  is_booked: number;
  share_message: string;
  pitch_types: any[];
  facilities: any[];
}

export interface GroundDetailResponse {
  status: boolean;
  data: Ground;
}