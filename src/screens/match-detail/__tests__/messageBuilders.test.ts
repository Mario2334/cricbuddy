// Golden tests: the refactored builders must produce byte-identical messages to
// the original MatchDetailScreen closures. Expected strings were captured from
// the original code (TZ pinned to Asia/Kolkata by jest.globalSetup.js).
import type { Ground } from '../../../types/Ground';
import type { Match } from '../../../types/Match';
import type { GoogleMapsPlace } from '../../../services/googleMapsService';
import {
  extractPlayersFromScorecard,
  generatePaymentWhatsAppMessage,
  generateWhatsAppMessage,
  type PaymentMessageInput,
  type WhatsAppMessageInput,
} from '../messageBuilders';
import type { ScorecardData } from '../types';

// The signature line carries U+2060 WORD JOINERs around the space.
const SIGNATURE = ' 1.⁠ ⁠Sanket';

const groundWithCoords = {
  ground_id: 77,
  name: 'HSR Layout Cricket Ground',
  latitude: '12.9116',
  longitude: '77.6474',
  place_id: 'ChIJ_ground',
  city_name: 'Bengaluru',
  address: '27th Main',
} as Ground;

const groundPlaceOnly = {
  ground_id: 88,
  name: 'Kensington Oval',
  latitude: '',
  longitude: '',
  place_id: 'ChIJplace88',
  city_name: 'Bengaluru',
  address: '',
} as Ground;

const place: GoogleMapsPlace = {
  place_id: 'ChIJgoogle123',
  name: 'Jayanagar Cricket Arena',
  formatted_address: 'Jayanagar, Bengaluru',
  geometry: { location: { lat: 1, lng: 2 } },
  types: ['stadium'],
};

const scorecard: ScorecardData = {
  pageProps: {
    scorecard: [
      { teamName: 'Titans XI', batting: [{ name: 'Opp One' }], toBeBat: [] },
      {
        teamName: 'Vikings Inspired',
        batting: [{ name: 'Sanket' }, { name: 'Rahul D' }, { name: 'Unknown' }, { name: '' }, { name: 'Amit K' }],
        toBeBat: [{ name: 'Rahul D' }, { name: 'Vikram S' }, { name: 'Unknown' }],
      },
    ],
  },
};

type Fixture = WhatsAppMessageInput & PaymentMessageInput & { fees?: number };

const fixtures: Record<'full' | 'placeAndScorecardPlayers' | 'noData' | 'placeIdGround', Fixture> = {
  // Ground with coordinates, explicit fees, players picked in the fees sheet.
  full: {
    matchId: '12345',
    tournamentName: 'Sunday Smash League',
    teamNames: { team1: 'Vikings Inspired', team2: 'Titans XI' },
    groundName: 'HSR Layout Cricket Ground',
    matchData: {
      match_id: 12345,
      match_start_time: '2026-10-25T01:30:00.000Z',
      overs: 20,
      match_type: 'T20',
      team_a_id: 5179117,
      team_b_id: 42,
    } as Partial<Match>,
    groundData: groundWithCoords,
    selectedGroundForWhatsApp: null,
    selectedGoogleMapsPlace: null,
    selectedBallJersey: 'White ball, Coloured Jersey',
    selectedPlayers: ['Sanket', 'Rahul D', 'Amit K'],
    matchFees: '8500',
    scorecard,
    fees: 9000,
  },
  // Google Maps place wins, start_time only, no overs/type, players from scorecard.
  placeAndScorecardPlayers: {
    matchId: '67890',
    tournamentName: 'Box  Cricket (Season 2.0)',
    teamNames: { team1: 'Titans XI', team2: 'Vikings Inspired' },
    groundName: 'Old Ground',
    matchData: {
      match_id: 67890,
      start_time: '2026-11-01T12:45:00.000Z',
      team_a_id: 42,
      team_b_id: 5179117,
    } as Partial<Match>,
    groundData: groundWithCoords,
    selectedGroundForWhatsApp: groundPlaceOnly,
    selectedGoogleMapsPlace: place,
    selectedBallJersey: 'Red Ball, White Jersey',
    selectedPlayers: [],
    matchFees: '7000',
    scorecard,
  },
  // Nothing loaded yet: every fallback path.
  noData: {
    matchId: '999',
    tournamentName: undefined,
    teamNames: { team1: 'Team A', team2: 'Team B' },
    groundName: undefined,
    matchData: null,
    groundData: null,
    selectedGroundForWhatsApp: null,
    selectedGoogleMapsPlace: null,
    selectedBallJersey: 'White ball, Coloured Jersey',
    selectedPlayers: [],
    matchFees: 'abc',
    scorecard: null,
  },
  // Ground with only a place_id; late-night start crosses no day boundary.
  placeIdGround: {
    matchId: '555',
    tournamentName: 'Weekday Bash',
    teamNames: { team1: 'Night Owls', team2: 'Early Birds' },
    groundName: 'Kensington Oval',
    matchData: {
      match_id: 555,
      match_start_time: '2026-12-31T18:00:00.000Z',
      overs: 16,
      match_type: 'T16',
      team_a_id: 1,
      team_b_id: 2,
    } as Partial<Match>,
    groundData: groundPlaceOnly,
    selectedGroundForWhatsApp: null,
    selectedGoogleMapsPlace: null,
    selectedBallJersey: 'Red Ball, White Jersey',
    selectedPlayers: ['Solo'],
    matchFees: '1001',
    scorecard: null,
  },
};

const lines = (...l: string[]) => l.join('\n');

describe('generateWhatsAppMessage (golden)', () => {
  it('ground with coordinates', () => {
    expect(generateWhatsAppMessage(fixtures.full)).toBe(
      lines(
        'Sunday Smash League match',
        'Vikings Inspired VS Titans XI',
        '',
        '📅 Match Date: Sunday 25 October',
        '🕐 Match Time: 7:00 AM',
        '⌚ Reporting Time: 6:30 AM',
        '🏏 Overs: 20 Overs',
        '👕 Ball & Jersey: White ball, Coloured Jersey',
        '📍Location: https://www.google.com/maps/search/?api=1&query=12.9116,77.6474',
        '',
        'Cricheroes : https://cricheroes.com/scorecard/12345/sunday-smash-league/vikings-inspired-vs-titans-xi',
        '',
        SIGNATURE,
      ),
    );
  });

  it('selected Google Maps place and start_time fallback', () => {
    expect(generateWhatsAppMessage(fixtures.placeAndScorecardPlayers)).toBe(
      lines(
        'Box  Cricket (Season 2.0) match',
        'Titans XI VS Vikings Inspired',
        '',
        '📅 Match Date: Sunday 1 November',
        '🕐 Match Time: 6:15 PM',
        '⌚ Reporting Time: 5:45 PM',
        '🏏 Overs: 20 Overs',
        '👕 Ball & Jersey: Red Ball, White Jersey',
        '📍Location: https://www.google.com/maps/place/?q=place_id:ChIJgoogle123',
        '',
        'Cricheroes : https://cricheroes.com/scorecard/67890/box-cricket-(season-2.0)/titans-xi-vs-vikings-inspired',
        '',
        SIGNATURE,
      ),
    );
  });

  it('no match data (TBD fallbacks)', () => {
    expect(generateWhatsAppMessage(fixtures.noData)).toBe(
      lines(
        'Cricket Tournament match',
        'Team A VS Team B',
        '',
        '📅 Match Date: TBD',
        '🕐 Match Time: TBD',
        '⌚ Reporting Time: TBD',
        '🏏 Overs: 20 Overs',
        '👕 Ball & Jersey: White ball, Coloured Jersey',
        '📍Location: https://maps.google.com/maps/search/Cricket%20Ground',
        '',
        'Cricheroes : https://cricheroes.com/scorecard/999/match/team-a-vs-team-b',
        '',
        SIGNATURE,
      ),
    );
  });

  it('ground with only a place_id', () => {
    expect(generateWhatsAppMessage(fixtures.placeIdGround)).toBe(
      lines(
        'Weekday Bash match',
        'Night Owls VS Early Birds',
        '',
        '📅 Match Date: Thursday 31 December',
        '🕐 Match Time: 11:30 PM',
        '⌚ Reporting Time: 11:00 PM',
        '🏏 Overs: 16 Overs',
        '👕 Ball & Jersey: Red Ball, White Jersey',
        '📍Location: https://www.google.com/maps/place/?q=place_id:ChIJplace88',
        '',
        'Cricheroes : https://cricheroes.com/scorecard/555/weekday-bash/night-owls-vs-early-birds',
        '',
        SIGNATURE,
      ),
    );
  });
});

describe('generatePaymentWhatsAppMessage (golden)', () => {
  it('explicit fees and selected players', () => {
    expect(generatePaymentWhatsAppMessage(fixtures.full, fixtures.full.fees)).toBe(
      lines(
        'T20 Sunday Smash League Match Payment - Sunday 25 October',
        '',
        'Match: Vikings Inspired VS Titans XI',
        'Date: Sunday 25 October',
        'Reporting Time: 6:30 AM',
        'Overs: 20 Overs',
        'Total Fees: ₹9000',
        'Cost PP (9000 ÷ 3): ₹3000',
        'UPI : hellrazer@ybl',
        'Phone No : 8484996704',
        'Players:',
        '\t1.\tSanket',
        '\t2.\tRahul D',
        '\t3.\tAmit K',
      ),
    );
  });

  it('falls back to matchFees and scorecard players (team B)', () => {
    expect(generatePaymentWhatsAppMessage(fixtures.placeAndScorecardPlayers)).toBe(
      lines(
        'T30 Box  Cricket (Season 2.0) Match Payment - Sunday 1 November',
        '',
        'Match: Titans XI VS Vikings Inspired',
        'Date: Sunday 1 November',
        'Reporting Time: 5:45 PM',
        'Overs: 30 Overs',
        'Total Fees: ₹7000',
        'Cost PP (7000 ÷ 4): ₹1750',
        'UPI : hellrazer@ybl',
        'Phone No : 8484996704',
        'Players:',
        '\t1.\tSanket',
        '\t2.\tRahul D',
        '\t3.\tAmit K',
        '\t4.\tVikram S',
      ),
    );
  });

  it('no data: hard-coded defaults, invalid fees, zero players', () => {
    expect(generatePaymentWhatsAppMessage(fixtures.noData)).toBe(
      lines(
        'T30 Sara Tournament Match Payment - 22nd June, Sunday',
        '',
        'Match: Team A VS Team B',
        'Date: 22nd June, Sunday',
        'Reporting Time: 7:00 AM',
        'Overs: 30 Overs',
        'Total Fees: ₹8500',
        'Cost PP (8500 ÷ 0): ₹Infinity',
        'UPI : hellrazer@ybl',
        'Phone No : 8484996704',
        'Players:',
        '',
      ),
    );
  });

  it('single selected player, place_id-only ground', () => {
    expect(generatePaymentWhatsAppMessage(fixtures.placeIdGround)).toBe(
      lines(
        'T16 Weekday Bash Match Payment - Thursday 31 December',
        '',
        'Match: Night Owls VS Early Birds',
        'Date: Thursday 31 December',
        'Reporting Time: 11:00 PM',
        'Overs: 16 Overs',
        'Total Fees: ₹1001',
        'Cost PP (1001 ÷ 1): ₹1001',
        'UPI : hellrazer@ybl',
        'Phone No : 8484996704',
        'Players:',
        '\t1.\tSolo',
      ),
    );
  });
});

describe('extractPlayersFromScorecard', () => {
  it('reads innings 0 when team A is ours', () => {
    expect(extractPlayersFromScorecard(fixtures.full.matchData, scorecard)).toEqual(['Opp One']);
  });

  it('reads innings 1 when team B is ours, skipping Unknown/empty and de-duplicating', () => {
    expect(extractPlayersFromScorecard(fixtures.placeAndScorecardPlayers.matchData, scorecard)).toEqual([
      'Sanket',
      'Rahul D',
      'Amit K',
      'Vikram S',
    ]);
  });

  it('returns [] without match data or when neither team is ours', () => {
    expect(extractPlayersFromScorecard(null, scorecard)).toEqual([]);
    expect(extractPlayersFromScorecard(fixtures.placeIdGround.matchData, scorecard)).toEqual([]);
  });
});
