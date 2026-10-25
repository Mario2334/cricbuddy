import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AIQuery, BallType } from '../types';
import queryProcessor, { QueryProcessor, QueryHistory } from '../utils/queryProcessor';
import {
  colors,
  curve,
  easings,
  enter,
  focusRing,
  fonts,
  glass,
  glows,
  gradients,
  radii,
  shadows,
  springs,
  tones,
} from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Chip } from '../../../ui/Chip';
import { GlassView } from '../../../ui/GlassView';
import { Icon } from '../../../ui/Icon';
import type { IconName } from '../../../ui/icons';
import { Skeleton } from '../../../ui/Skeleton';
import { SpinningBall } from '../../../ui/CricketBall';
import { haptic } from '../../../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const INPUT_HEIGHT = 52;
const MAX_STATUS_CHARS = 32;
// Plain strings so the focus worklet captures values, not the whole theme object.
const BORDER_IDLE: string = glass.rim;
const BORDER_FOCUS: string = colors.primary;

interface SearchInterfaceProps {
  onQuerySubmit: (query: AIQuery) => void;
  onQueryClear: () => void;
  loading?: boolean;
  placeholder?: string;
  initialQuery?: string;
  onBallTypeFilter?: (ballType: BallType | null) => void;
  selectedBallType?: BallType | null;
}

interface SuggestionItem {
  id: string;
  text: string;
  type: 'suggestion' | 'history' | 'example';
  timestamp?: Date;
}

const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onQuerySubmit,
  onQueryClear,
  loading = false,
  placeholder = 'Search for cricket opportunities...',
  initialQuery = '',
  onBallTypeFilter,
  selectedBallType = null,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedQuery, setLastProcessedQuery] = useState('');
  
  const inputRef = useRef<TextInput>(null);
  const processor = useRef<QueryProcessor>(queryProcessor);

  // Smooth motion: a focus ring eases in around the glass pill, the submit button dips on press.
  const reduced = useReducedMotion();
  const focus = useSharedValue(0);
  const submitScale = useSharedValue(1);
  const busy = loading || isProcessing;

  // Load query history on component mount
  useEffect(() => {
    const history = processor.current.getQueryHistory();
    setQueryHistory(history);
  }, []);

  // Update suggestions when query changes
  useEffect(() => {
    if (query.trim().length > 0) {
      updateSuggestions(query);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setShowSuggestions(false);
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  const updateSuggestions = useCallback((searchText: string) => {
    const newSuggestions: SuggestionItem[] = [];
    const lowerSearchText = searchText.toLowerCase();

    // Add query history matches
    const historyMatches = queryHistory
      .filter(h => 
        h.success && 
        h.query.toLowerCase().includes(lowerSearchText) &&
        h.query.toLowerCase() !== lowerSearchText
      )
      .slice(0, 3)
      .map((h, index) => ({
        id: `history-${index}`,
        text: h.query,
        type: 'history' as const,
        timestamp: h.timestamp,
      }));

    newSuggestions.push(...historyMatches);

    // Add example suggestions
    const exampleSuggestions = processor.current
      .getQuerySuggestions()
      .filter(suggestion => 
        suggestion.toLowerCase().includes(lowerSearchText) &&
        suggestion.toLowerCase() !== lowerSearchText
      )
      .slice(0, 5 - historyMatches.length)
      .map((suggestion, index) => ({
        id: `example-${index}`,
        text: suggestion,
        type: 'example' as const,
      }));

    newSuggestions.push(...exampleSuggestions);

    // Add smart suggestions based on partial input
    const smartSuggestions = generateSmartSuggestions(searchText)
      .filter(suggestion => !newSuggestions.some(s => s.text === suggestion))
      .slice(0, 3)
      .map((suggestion, index) => ({
        id: `smart-${index}`,
        text: suggestion,
        type: 'suggestion' as const,
      }));

    newSuggestions.push(...smartSuggestions);

    setSuggestions(newSuggestions.slice(0, 8)); // Limit to 8 suggestions
  }, [queryHistory]);

  const generateSmartSuggestions = useCallback((searchText: string): string[] => {
    const suggestions: string[] = [];
    const lowerText = searchText.toLowerCase();

    // Position-based suggestions
    if (lowerText.includes('bat') && !lowerText.includes('batsman')) {
      suggestions.push(`${searchText}sman needed for match`);
    }
    if (lowerText.includes('bowl') && !lowerText.includes('bowler')) {
      suggestions.push(`${searchText}er needed for game`);
    }
    if (lowerText.includes('keep') && !lowerText.includes('keeper')) {
      suggestions.push(`wicket-${searchText}er needed`);
    }

    // Time-based suggestions
    if (lowerText.includes('morn') && !lowerText.includes('morning')) {
      suggestions.push(`${searchText}ing match available`);
    }
    if (lowerText.includes('eve') && !lowerText.includes('evening')) {
      suggestions.push(`${searchText}ning game looking for players`);
    }

    // Date-based suggestions
    if (lowerText.includes('tom') && !lowerText.includes('tomorrow')) {
      suggestions.push(`${searchText}orrow match needs players`);
    }
    if (lowerText.includes('week') && !lowerText.includes('weekend')) {
      suggestions.push(`${searchText}end games available`);
    }

    // Generic completions
    if (lowerText.length >= 3 && !suggestions.length) {
      suggestions.push(`Find ${searchText} for cricket match`);
      suggestions.push(`Looking for ${searchText} players`);
    }

    return suggestions;
  }, []);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    
    if (text.trim().length === 0) {
      setShowSuggestions(false);
      if (lastProcessedQuery) {
        onQueryClear();
        setLastProcessedQuery('');
      }
    } else {
      // Temporarily disable suggestions - keep this false to prevent suggestions from showing
      setShowSuggestions(false);
    }
  }, [onQueryClear, lastProcessedQuery]);

  const handleQuerySubmit = useCallback(async (queryText?: string) => {
    const finalQuery = queryText || query;
    if (!finalQuery.trim()) return;

    setIsProcessing(true);
    setShowSuggestions(false);
    Keyboard.dismiss();

    try {
      const aiQuery = await processor.current.processQuery(finalQuery.trim());
      setLastProcessedQuery(finalQuery.trim());
      
      // Update query history
      const updatedHistory = processor.current.getQueryHistory();
      setQueryHistory(updatedHistory);
      
      onQuerySubmit(aiQuery);
    } catch (error) {
      console.error('[SearchInterface] Error processing query:', error);
      
      // Provide fallback result
      const fallbackQuery: AIQuery = {
        rawQuery: finalQuery.trim(),
        processedFilters: {},
        confidence: 0.1,
        suggestions: [
          'Search temporarily unavailable',
          'Please try again in a moment',
          'Check your internet connection',
        ],
      };
      
      onQuerySubmit(fallbackQuery);
    } finally {
      setIsProcessing(false);
    }
  }, [query, onQuerySubmit]);

  const handleSuggestionPress = useCallback((suggestion: SuggestionItem) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    handleQuerySubmit(suggestion.text);
  }, [handleQuerySubmit]);

  const handleClearQuery = useCallback(() => {
    setQuery('');
    setShowSuggestions(false);
    setLastProcessedQuery('');
    onQueryClear();
    inputRef.current?.focus();
  }, [onQueryClear]);

  const handleInputFocus = useCallback(() => {
    focus.value = reduced ? 1 : withTiming(1, { duration: 220, easing: easings.out });
    // Temporarily disable suggestions on focus
    // if (query.trim().length > 0) {
    //   setShowSuggestions(true);
    // }
  }, [query, focus, reduced]);

  const handleInputBlur = useCallback(() => {
    focus.value = reduced ? 0 : withTiming(0, { duration: 180 });
    // Delay hiding suggestions to allow for suggestion tap
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  }, [focus, reduced]);

  const pillStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [BORDER_IDLE, BORDER_FOCUS]),
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: focus.value }));
  const submitStyle = useAnimatedStyle(() => ({ transform: [{ scale: submitScale.value }] }));

  const renderSuggestion = useCallback(({ item }: { item: SuggestionItem }) => {
    const getIcon = (): IconName => {
      switch (item.type) {
        case 'history':
          return 'history';
        case 'example':
          return 'idea';
        case 'suggestion':
          return 'search';
        default:
          return 'search';
      }
    };

    const getIconColor = () => {
      switch (item.type) {
        case 'history':
          return colors.textSoft;
        case 'example':
          return colors.primaryStrong;
        case 'suggestion':
          return colors.textMuted;
        default:
          return colors.textMuted;
      }
    };

    return (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleSuggestionPress(item)}
        activeOpacity={0.7}
      >
        <Icon name={getIcon()} size={18} color={getIconColor()} />
        <AppText variant="body" style={styles.suggestionText} numberOfLines={1}>
          {item.text}
        </AppText>
        {item.type === 'history' && item.timestamp && (
          <AppText variant="caption" color={colors.textMuted} style={styles.suggestionTime}>
            {formatTimeAgo(item.timestamp)}
          </AppText>
        )}
      </TouchableOpacity>
    );
  }, [handleSuggestionPress]);

  const keyExtractor = useCallback((item: SuggestionItem) => item.id, []);

  const handleBallTypePress = useCallback((ballType: BallType) => {
    const newBallType = selectedBallType === ballType ? null : ballType;
    if (onBallTypeFilter) {
      onBallTypeFilter(newBallType);
    }
  }, [selectedBallType, onBallTypeFilter]);

  const canSubmit = !busy && query.trim().length > 0;
  const statusLabel =
    lastProcessedQuery.length > MAX_STATUS_CHARS
      ? `“${lastProcessedQuery.slice(0, MAX_STATUS_CHARS - 1).trimEnd()}…”`
      : `“${lastProcessedQuery}”`;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.inputWrap}>
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.inputContainer, pillStyle]}>
            <Icon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={query}
              onChangeText={handleQueryChange}
              onSubmitEditing={() => handleQuerySubmit()}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              editable={!loading && !isProcessing}
              maxFontSizeMultiplier={1.4}
            />

            {busy && (
              <View style={styles.loadingIndicator}>
                <SpinningBall size={20} />
              </View>
            )}

            {query.length > 0 && !busy && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearQuery}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Icon name="closeCircle" size={20} weight="fill" color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {canSubmit && (
          <Animated.View entering={reduced ? undefined : enter.pop()}>
            <AnimatedPressable
              style={[styles.submitButton, submitStyle]}
              onPressIn={() => {
                submitScale.value = withSpring(0.9, springs.press);
              }}
              onPressOut={() => {
                submitScale.value = withSpring(1, springs.release);
              }}
              onPress={() => {
                haptic('light');
                handleQuerySubmit();
              }}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <View pointerEvents="none" style={styles.submitFace}>
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient colors={gradients.glassSheen} style={styles.submitSheen} />
              </View>
              <Icon name="arrowRight" size={22} weight="bold" color={colors.onPrimary} />
            </AnimatedPressable>
          </Animated.View>
        )}
      </View>

      {/* Ball Type Filter */}
      <View style={styles.filterContainer}>
        <AppText variant="overline" color={colors.textMuted} style={styles.filterLabel}>
          Ball
        </AppText>
        <View style={styles.ballTypeFilters}>
          <Chip
            label="Leather"
            icon="ball"
            selected={selectedBallType === BallType.LEATHER}
            haptic={false}
            onPress={() => handleBallTypePress(BallType.LEATHER)}
          />
          <Chip
            label="Tennis"
            icon="tennis"
            selected={selectedBallType === BallType.TENNIS}
            haptic={false}
            onPress={() => handleBallTypePress(BallType.TENNIS)}
          />
        </View>
      </View>

      {/* Suggestions Modal */}
      <Modal
        visible={showSuggestions && suggestions.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuggestions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSuggestions(false)}
        >
          {/* Frost, not blur: the modal fades in, and BlurView glitches under an animating opacity. */}
          <GlassView mode="frost" radius={radii.lg} shadow="float" style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions}
              keyExtractor={keyExtractor}
              renderItem={renderSuggestion}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </GlassView>
        </TouchableOpacity>
      </Modal>

      {/* AI thinking */}
      {busy && <ThinkingLine />}

      {/* Query Status */}
      {!!lastProcessedQuery && !busy && (
        <Animated.View
          key={lastProcessedQuery}
          entering={reduced ? undefined : enter.pop()}
          style={styles.queryStatus}
        >
          <AppText variant="caption" color={colors.textMuted} style={styles.queryStatusText}>
            Showing results for
          </AppText>
          <Chip
            label={statusLabel}
            icon="search"
            tone="yellow"
            selected
            haptic={false}
            onRemove={handleClearQuery}
          />
        </Animated.View>
      )}
    </View>
  );
};

/** Pulsing "Thinking…" line with a shimmer bar while the AI works on the query. */
function ThinkingLine() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(0.4, { duration: 650, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  // The brain breathes with the text: slightly larger at full opacity.
  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 0.92 + pulse.value * 0.08 }],
  }));

  return (
    <View style={styles.thinking} accessibilityLiveRegion="polite" accessibilityLabel="Thinking">
      <Animated.View style={[styles.thinkingIcon, iconStyle]}>
        <Icon name="ai" size={16} color={tones.violet.softInk} />
      </Animated.View>
      <Animated.View style={pulseStyle}>
        <AppText variant="smallStrong" color={colors.primaryStrong}>
          Thinking…
        </AppText>
      </Animated.View>
      <Skeleton height={10} radius={radii.pill} style={styles.thinkingBar} />
    </View>
  );
}

// Helper function to format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInHours < 24) return `${diffInHours}h`;
  if (diffInDays < 7) return `${diffInDays}d`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
  },
  // Same shape as the pill; its focusRing shadow paints a soft halo just outside it.
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    ...focusRing,
  },
  inputContainer: {
    height: INPUT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glass.fillStrong,
    borderRadius: radii.pill,
    ...curve,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: glass.rim,
    ...shadows.glass,
  },
  searchIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0, // Remove default padding on Android
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
  },
  submitButton: {
    width: INPUT_HEIGHT,
    height: INPUT_HEIGHT,
    borderRadius: INPUT_HEIGHT / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...glows.emerald,
  },
  submitFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INPUT_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  submitSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: INPUT_HEIGHT * 0.55,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    paddingTop: 100, // Adjust based on search bar position
  },
  suggestionsContainer: {
    marginHorizontal: 16,
    maxHeight: 300,
  },
  suggestionsList: {
    borderRadius: radii.lg,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.divider,
  },
  suggestionText: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionTime: {
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  filterLabel: {
    marginRight: 10,
  },
  ballTypeFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  thinkingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tones.violet.soft,
  },
  thinkingBar: {
    flex: 1,
    maxWidth: 140,
  },
  queryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
  },
  queryStatusText: {
    flexShrink: 0,
  },
});

export default SearchInterface;
