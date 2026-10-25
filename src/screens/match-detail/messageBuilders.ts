// Pure builders for the "Copy to WhatsApp" and "Write Payments" messages.
// The bodies are lifted verbatim from the original MatchDetailScreen; only the
// closure variables became explicit inputs. Keep this file free of React /
// React Native imports so the golden tests stay pure.
import type { Ground } from '../../types/Ground';
import type { Match } from '../../types/Match';
import googleMapsService, { type GoogleMapsPlace } from '../../services/googleMapsService';
import { buildCricHeroesMatchUrl } from '../../utils/matchLinks';
import type { ScorecardData } from './types';

export interface MessageContext {
  matchId: string;
  tournamentName: string | undefined;
  teamNames: { team1: string; team2: string };
  /** Route param ground name (fallback when no ground is selected). */
  groundName?: string;
  matchData: Partial<Match> | null;
  groundData: Ground | null;
  selectedGroundForWhatsApp: Ground | null;
  selectedGoogleMapsPlace: GoogleMapsPlace | null;
}

export interface WhatsAppMessageInput extends MessageContext {
  selectedBallJersey: string;
}

export interface PaymentMessageInput extends MessageContext {
  selectedPlayers: string[];
  matchFees: string;
  scorecard: ScorecardData | null;
}

export const extractPlayersFromScorecard = (
  matchData: Partial<Match> | null,
  scorecard: ScorecardData | null,
): string[] => {
  let players: string[] = [];

  if (matchData) {
    // Determine which team corresponds to team 5179117 and extract players from scorecard
    let targetTeamScorecard = null;

    if (matchData.team_a_id && matchData.team_a_id === 5179117) {
      targetTeamScorecard = scorecard?.pageProps?.scorecard?.[0];
    } else if (matchData.team_b_id && matchData.team_b_id === 5179117) {
      targetTeamScorecard = scorecard?.pageProps?.scorecard?.[1];
    }

    if (targetTeamScorecard) {
      // Add batting players
      if (targetTeamScorecard.batting && Array.isArray(targetTeamScorecard.batting)) {
        targetTeamScorecard.batting.forEach((batsman: any) => {
          if (batsman.name && batsman.name !== 'Unknown') {
            players.push(batsman.name);
          }
        });
      }

      // Add yet to bat players (to_be_bat)
      if (targetTeamScorecard.toBeBat && Array.isArray(targetTeamScorecard.toBeBat)) {
        targetTeamScorecard.toBeBat.forEach((player: any) => {
          if (player.name && player.name !== 'Unknown') {
            players.push(player.name);
          }
        });
      }
    }
  }

  // Remove duplicates
  return [...new Set(players)];
};

export const generateWhatsAppMessage = (input: WhatsAppMessageInput): string => {
  const {
    matchId,
    tournamentName,
    teamNames,
    groundName,
    matchData,
    groundData,
    selectedGroundForWhatsApp,
    selectedGoogleMapsPlace,
    selectedBallJersey,
  } = input;
  const selectedGround = selectedGroundForWhatsApp || groundData;

  // Format date - use matchData instead of scorecard
  const matchDate = matchData?.match_start_time || matchData?.start_time
    ? new Date(matchData.match_start_time || matchData.start_time || '').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        weekday: 'long'
      })
    : 'TBD';

  // Format match time
  const matchTime = matchData?.match_start_time || matchData?.start_time
    ? new Date(matchData.match_start_time || matchData.start_time || '').toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : 'TBD';

  // Format time - reporting time is 30 minutes before match time
  const reportingTime = matchData?.match_start_time || matchData?.start_time
    ? (() => {
        const matchDateTime = new Date(matchData.match_start_time || matchData.start_time || '');
        const reportingDateTime = new Date(matchDateTime.getTime() - 30 * 60 * 1000); // Subtract 30 minutes
        return reportingDateTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      })()
    : 'TBD';

  // Generate Google Maps link
  let locationLink = '';
  if (selectedGoogleMapsPlace) {
    locationLink = googleMapsService.generateMapsUrl(selectedGoogleMapsPlace);
  } else if (selectedGround?.latitude && selectedGround?.longitude) {
    locationLink = `https://maps.google.com/?q=${selectedGround.latitude},${selectedGround.longitude}`;
  } else if (selectedGround?.place_id) {
    locationLink = `https://www.google.com/maps/place/?q=place_id:${selectedGround.place_id}`;
  } else {
    locationLink = `https://maps.google.com/maps/search/${encodeURIComponent(selectedGround?.name || groundName || 'Cricket Ground')}`;
  }

  // Normalize the URL to handle any problematic formats
  locationLink = googleMapsService.normalizeGoogleMapsUrl(locationLink);

  // Generate Cricheroes link
  const cricHeroesLink = buildCricHeroesMatchUrl(matchId, tournamentName, teamNames);

  const message = `${tournamentName || 'Cricket Tournament'} match
${teamNames.team1} VS ${teamNames.team2}

📅 Match Date: ${matchDate}
🕐 Match Time: ${matchTime}
⌚ Reporting Time: ${reportingTime}
🏏 Overs: ${matchData?.overs || '20'} Overs
👕 Ball & Jersey: ${selectedBallJersey}
📍Location: ${locationLink}

Cricheroes : ${cricHeroesLink}

 1.⁠ ⁠Sanket`;

  return message;
};

export const generatePaymentWhatsAppMessage = (input: PaymentMessageInput, fees?: number): string => {
  const {
    tournamentName,
    teamNames,
    groundName,
    matchData,
    groundData,
    selectedGroundForWhatsApp,
    selectedGoogleMapsPlace,
    selectedPlayers,
    matchFees,
    scorecard,
  } = input;
  const selectedGround = selectedGroundForWhatsApp || groundData;

  // Format date - use matchData instead of scorecard
  const matchDate = matchData?.match_start_time || matchData?.start_time
    ? new Date(matchData.match_start_time || matchData.start_time || '').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        weekday: 'long'
      })
    : '22nd June, Sunday';

  // Format time - reporting time is 30 minutes before match time
  const reportingTime = matchData?.match_start_time || matchData?.start_time
    ? (() => {
        const matchDateTime = new Date(matchData.match_start_time || matchData.start_time || '');
        const reportingDateTime = new Date(matchDateTime.getTime() - 30 * 60 * 1000); // Subtract 30 minutes
        return reportingDateTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      })()
    : '7:00 AM';

  // Generate Google Maps link
  let locationLink = 'Google Maps';
  if (selectedGoogleMapsPlace) {
    locationLink = googleMapsService.generateMapsUrl(selectedGoogleMapsPlace);
  } else if (selectedGround?.latitude && selectedGround?.longitude) {
    locationLink = `https://maps.google.com/?q=${selectedGround.latitude},${selectedGround.longitude}`;
  } else if (selectedGround?.place_id) {
    locationLink = `https://www.google.com/maps/place/?q=place_id:${selectedGround.place_id}`;
  } else if (selectedGround?.name || groundName) {
    locationLink = `https://maps.google.com/maps/search/${encodeURIComponent(selectedGround?.name || groundName || 'Cricket Ground')}`;
  }

  // Normalize the URL to handle any problematic formats
  if (locationLink !== 'Google Maps') {
    locationLink = googleMapsService.normalizeGoogleMapsUrl(locationLink);
  }

  // Use selected players from the checkbox list
  const players = selectedPlayers.length > 0 ? selectedPlayers : extractPlayersFromScorecard(matchData, scorecard);

  // Payment details - use provided fees or default
  const totalFees = fees || parseInt(matchFees) || 8500;
  const costPerPlayer = Math.ceil(totalFees / players.length);
  const upiId = 'hellrazer@ybl';
  const phone_no = "8484996704"
  // Format players list with payment status
  const playersListText = players.map((player, index) => {
    return `\t${index + 1}.\t${player}`;
  }).join('\n');

  const message = `${matchData?.match_type || 'T30'} ${tournamentName || 'Sara Tournament'} Match Payment - ${matchDate}

Match: ${teamNames.team1} VS ${teamNames.team2}
Date: ${matchDate}
Reporting Time: ${reportingTime}
Overs: ${matchData?.overs || '30'} Overs
Total Fees: ₹${totalFees}
Cost PP (${totalFees} ÷ ${players.length}): ₹${costPerPlayer}
UPI : ${upiId}
Phone No : ${phone_no}
Players:
${playersListText}`;

  return message;
};
