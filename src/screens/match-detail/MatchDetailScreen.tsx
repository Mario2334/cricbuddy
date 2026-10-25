import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { TabView, type NavigationState, type SceneRendererProps } from 'react-native-tab-view';
import type { MatchDetailScreenNavigationProp } from '../../types/navigation';
import { space } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { MeshBackground } from '../../ui/MeshBackground';
import { TabViewSegmentedBar } from '../../ui/adapters/TabViewSegmentedBar';
import { useNow } from '../../hooks/useNow';
import { normalizeStatus } from '../../utils/matchDisplay';
import { useMatchDetail } from './useMatchDetail';
import type { MainTabRoute } from './types';
import { MatchHero } from './MatchHero';
import { MatchDetailLoading } from './MatchDetailLoading';
import { InfoTab } from './InfoTab';
import { ScorecardTab } from './scorecard/ScorecardTab';
import { GroundPickerSheet } from './sheets/GroundPickerSheet';
import { PlacePickerSheet } from './sheets/PlacePickerSheet';
import { BallJerseySheet } from './sheets/BallJerseySheet';
import { FeesSheet } from './sheets/FeesSheet';
import { PaymentSheet } from './sheets/PaymentSheet';

type Props = MatchDetailScreenNavigationProp;

// BottomSheet keeps its Modal mounted for its ~220ms exit animation, and iOS
// can't present a second modal while one is still up. The fees sheet hands off
// straight to the payment sheet, so hold the payment sheet until it has gone.
const SHEET_EXIT_MS = 350;

function useClosingDelay(open: boolean, ms = SHEET_EXIT_MS): boolean {
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    if (was && !open) {
      setClosing(true);
      const t = setTimeout(() => setClosing(false), ms);
      return () => clearTimeout(t);
    }
    setClosing(false);
    return undefined;
  }, [open, ms]);
  return closing;
}

export default function MatchDetailScreen({ route, navigation }: Props) {
  const md = useMatchDetail(route.params);
  const isFocused = useIsFocused();
  const layout = useWindowDimensions();
  const now = useNow(60_000, { enabled: isFocused });
  const feesSheetClosing = useClosingDelay(md.showFeesInputDialog);

  const status = normalizeStatus(md.matchStatus);
  // CHANGED: only the very first load replaces the body; live/pull refreshes
  // keep the UI mounted and show a small spinning ball in the hero instead.
  const firstLoad = md.loading && !md.scorecard;
  const updating = md.loading && !!md.scorecard;

  // Scenes are rendered from current state on every render (never SceneMap).
  const renderScene = ({ route: tab }: SceneRendererProps & { route: MainTabRoute }) => {
    switch (tab.key) {
      case 'info':
        return <InfoTab md={md} />;
      case 'scorecard':
        return (
          <ScorecardTab
            scorecard={md.scorecard}
            routes={md.scorecardRoutes}
            index={md.scorecardTabIndex}
            onIndexChange={md.setScorecardTabIndex}
            refreshing={md.refreshing}
            onRefresh={md.onRefresh}
          />
        );
      default:
        return null;
    }
  };

  const renderTabBar = (props: SceneRendererProps & { navigationState: NavigationState<MainTabRoute> }) => (
    <TabViewSegmentedBar {...props} icons={{ info: 'info', scorecard: 'bat' }} style={styles.mainTabs} />
  );

  let body: React.ReactNode;
  if (firstLoad) {
    body = <MatchDetailLoading />;
  } else if (md.error) {
    body = (
      <View style={styles.error}>
        <EmptyState
          icon="oops"
          tone="error"
          title={md.error}
          message="The scorecard didn't make it to the crease."
          actionLabel="Retry"
          onAction={md.fetchScorecard}
        />
      </View>
    );
  } else {
    body = (
      <TabView
        navigationState={{ index: md.mainTabIndex, routes: md.mainTabRoutes }}
        renderScene={renderScene}
        onIndexChange={md.setMainTabIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={renderTabBar}
        style={styles.flex}
      />
    );
  }

  return (
    <MeshBackground variant="calm">
      {isFocused ? <StatusBar style="light" /> : null}

      <MatchHero
        tournamentName={md.matchData?.tournament_name || md.tournamentName}
        teamNames={md.teamNames}
        matchData={md.matchData}
        matchStartTime={md.matchStartTime}
        status={status}
        now={now}
        onBack={() => navigation.goBack()}
        updating={updating}
        autoRefreshing={!!md.autoRefreshInterval}
      />

      <View style={styles.flex}>{body}</View>

      {/* Sheets live at screen level, outside the TabView. */}
      <GroundPickerSheet
        visible={md.showGroundDropdown}
        grounds={md.availableGrounds}
        selected={md.selectedGroundForWhatsApp}
        onSelect={item => {
          md.setSelectedGroundForWhatsApp(item);
          md.setShowGroundDropdown(false);
        }}
        onClose={() => md.setShowGroundDropdown(false)}
      />

      <PlacePickerSheet
        visible={md.showGoogleMapsModal}
        searching={md.searchingPlaces}
        places={md.googleMapsPlaces}
        selected={md.selectedGoogleMapsPlace}
        onSelect={item => {
          md.setSelectedGoogleMapsPlace(item);
        }}
        onConfirm={md.copyToWhatsAppWithSelectedPlace}
        onClose={() => md.setShowGoogleMapsModal(false)}
      />

      <BallJerseySheet
        visible={md.showBallJerseyDropdown}
        options={md.ballJerseyOptions}
        selected={md.selectedBallJersey}
        onSelect={item => {
          md.setSelectedBallJersey(item);
          md.setShowBallJerseyDropdown(false);
        }}
        onClose={() => md.setShowBallJerseyDropdown(false)}
      />

      <FeesSheet
        visible={md.showFeesInputDialog}
        matchFees={md.matchFees}
        onChangeFees={md.setMatchFees}
        availablePlayers={md.availablePlayers}
        selectedPlayers={md.selectedPlayers}
        onTogglePlayer={md.togglePlayerSelection}
        onSelectAll={md.selectAllPlayers}
        onSelectNone={md.deselectAllPlayers}
        onSubmit={md.handleFeesSubmit}
        onClose={() => md.setShowFeesInputDialog(false)}
      />

      <PaymentSheet
        visible={md.showPaymentDialog && !feesSheetClosing}
        message={md.paymentMessage}
        onCopy={md.copyPaymentMessageFromDialog}
        onClose={() => md.setShowPaymentDialog(false)}
      />
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mainTabs: { paddingTop: space.md },
  error: { flex: 1, justifyContent: 'center' },
});
