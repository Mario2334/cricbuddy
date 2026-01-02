import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { FitnessStackParamList } from '../types/navigation';
import { templateService } from '../services/templateService';
import { MuscleGroupCategory, WorkoutTemplate } from '../types/fitness';

type Props = StackScreenProps<FitnessStackParamList, 'WorkoutTemplates'>;

/**
 * Category display configuration
 */
const CATEGORY_CONFIG: Record<MuscleGroupCategory, { 
  title: string; 
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}> = {
  BACK_BICEPS: {
    title: 'Back & Biceps',
    icon: 'fitness',
    color: '#14B8A6',
    description: 'Pull movements for back and arm development',
  },
  CHEST_TRICEPS: {
    title: 'Chest & Triceps',
    icon: 'barbell',
    color: '#EF4444',
    description: 'Push movements for chest and arm strength',
  },
  LEGS: {
    title: 'Legs',
    icon: 'walk',
    color: '#8B5CF6',
    description: 'Lower body strength and power',
  },
  SHOULDERS: {
    title: 'Shoulders',
    icon: 'body',
    color: '#EC4899',
    description: 'Shoulder development and stability',
  },
};

/**
 * WorkoutTemplatesScreen
 * 
 * Displays all 4 workout categories as cards.
 * Shows template name and exercise count.
 * Navigates to template detail on selection.
 * 
 * Requirements: 3.1, 3.2
 */
const WorkoutTemplatesScreen: React.FC<Props> = ({ navigation }) => {
  const templates = useMemo(() => templateService.getAllTemplates(), []);

  const handleTemplatePress = (template: WorkoutTemplate) => {
    navigation.navigate('WorkoutTemplateDetail', { templateId: template.id });
  };

  const renderTemplateCard = (template: WorkoutTemplate) => {
    const config = CATEGORY_CONFIG[template.category];
    const exerciseCount = template.exercises.length;
    const coreCount = template.core?.length ?? 0;
    const totalExercises = exerciseCount + coreCount;

    return (
      <TouchableOpacity
        key={template.id}
        style={styles.templateCard}
        onPress={() => handleTemplatePress(template)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIconContainer, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon} size={32} color="#fff" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{template.name}</Text>
          <Text style={styles.cardDescription}>{config.description}</Text>
          <View style={styles.cardStats}>
            <View style={styles.statItem}>
              <Ionicons name="barbell-outline" size={16} color="#666" />
              <Text style={styles.statText}>{totalExercises} exercises</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="layers-outline" size={16} color="#666" />
              <Text style={styles.statText}>
                {template.focusAreas.join(', ')}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workout Templates</Text>
        <Text style={styles.headerSubtitle}>
          Choose a preloaded workout to get started quickly
        </Text>
      </View>

      <View style={styles.templatesContainer}>
        {templates.map(renderTemplateCard)}
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#3498db" />
        <Text style={styles.infoText}>
          Templates include warm-up, main exercises, and stretching routines
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  templatesContainer: {
    padding: 16,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976d2',
  },
});

export default WorkoutTemplatesScreen;
