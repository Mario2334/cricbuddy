/**
 * Preloaded Workout Templates
 * 
 * Static workout templates for common muscle group combinations.
 * These templates are available offline and can be used to quickly
 * start a structured workout session.
 */

import { WorkoutTemplate } from '../types/fitness';

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // ============================================
  // BACK & BICEPS WORKOUT
  // ============================================
  {
    id: 'back-biceps-1',
    name: 'Back & Biceps',
    category: 'BACK_BICEPS',
    focusAreas: ['BACK', 'BICEPS'],
    warmUp: {
      cardio: { name: 'Cycle', durationMins: 10 },
      circuit: [
        { name: 'Dynamic Pigeon Stretch: Left', reps: 10 },
        { name: 'Dynamic Pigeon Stretch: Right', reps: 10 },
        { name: 'Half Wipers-Scale Down', reps: 15 },
        { name: 'Table Top Up And Down', reps: 15 },
        { name: 'Side To Side Shuffle', durationSecs: 45 },
      ]
    },
    exercises: [
      // Back exercises
      { name: 'Lat Pulldown', targetGroup: 'BACK', defaultSets: 4, defaultReps: [12, 10, 10, 8] },
      { name: 'Seated Cable Row', targetGroup: 'BACK', defaultSets: 4, defaultReps: [12, 10, 10, 8] },
      { name: 'T-Bar Row', targetGroup: 'BACK', defaultSets: 4, defaultReps: [12, 10, 10, 8] },
      { name: 'Single Arm Dumbbell Row', targetGroup: 'BACK', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Straight Arm Pulldown', targetGroup: 'BACK', defaultSets: 3, defaultReps: [15, 15, 15] },
      { name: 'Face Pulls', targetGroup: 'BACK', defaultSets: 3, defaultReps: [15, 15, 15] },
      // Biceps exercises
      { name: 'Barbell Curl', targetGroup: 'BICEPS', defaultSets: 4, defaultReps: [12, 10, 10, 8] },
      { name: 'Hammer Curl', targetGroup: 'BICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Incline Dumbbell Curl', targetGroup: 'BICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Cable Curl', targetGroup: 'BICEPS', defaultSets: 3, defaultReps: [15, 15, 15] },
      { name: 'Concentration Curl', targetGroup: 'BICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
    ],
    stretch: [
      { name: 'Hamstring Stretch', durationSecs: 40 },
      { name: "Child's Pose", durationSecs: 40 },
      { name: 'Prone Quad Stretch: Left', durationSecs: 40 },
      { name: 'Prone Quad Stretch: Right', durationSecs: 40 },
      { name: 'Butterfly Stretch', durationSecs: 40 },
    ]
  },


  // ============================================
  // CHEST & TRICEPS WORKOUT
  // ============================================
  {
    id: 'chest-triceps-1',
    name: 'Chest & Triceps',
    category: 'CHEST_TRICEPS',
    focusAreas: ['CHEST', 'TRICEPS'],
    warmUp: {
      cardio: { name: 'Cycle', durationMins: 10 },
      circuit: [
        { name: 'High Knees', durationSecs: 45 },
        { name: 'Prone Walkout', durationSecs: 45 },
        { name: 'Deltoid Circles', durationSecs: 45 },
        { name: 'Kettlebell Halo', reps: 15 },
      ]
    },
    exercises: [
      // Chest exercises
      { name: 'Push Up - Normal', targetGroup: 'CHEST', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Flat Dumbbell Press', targetGroup: 'CHEST', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Dumbbell Incline Press', targetGroup: 'CHEST', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Cable Crossover Flyes', targetGroup: 'CHEST', defaultSets: 3, defaultReps: [12, 10, 8] },
      // Triceps exercises
      { name: 'Barbell Close Grip Bench Press', targetGroup: 'TRICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Dumbbell Tricep Extension', targetGroup: 'TRICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Cable Tricep Rope Push Down', targetGroup: 'TRICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Triceps Kick Back', targetGroup: 'TRICEPS', defaultSets: 3, defaultReps: [12, 10, 8] },
    ],
    stretch: [
      { name: 'Sphinx Stretch', durationSecs: 40 },
      { name: "Child's Pose", durationSecs: 40 },
      { name: 'Kneeling Shoulder Extension Pec Stretch', durationSecs: 40 },
      { name: 'Kneeling Shoulder Archer Stretch: Left', durationSecs: 40 },
      { name: 'Kneeling Shoulder Archer Stretch: Right', durationSecs: 40 },
    ]
  },


  // ============================================
  // LEGS WORKOUT
  // ============================================
  {
    id: 'legs-1',
    name: 'Legs',
    category: 'LEGS',
    focusAreas: ['LEGS'],
    warmUp: {
      cardio: { name: 'Cycle', durationMins: 10 },
      circuit: [
        { name: 'Dynamic Pigeon Stretch: Left', reps: 10 },
        { name: 'Dynamic Pigeon Stretch: Right', reps: 10 },
        { name: 'Half Wipers-Scale Down', reps: 15 },
        { name: 'Table Top Up And Down', reps: 15 },
        { name: 'Side To Side Shuffle', durationSecs: 45 },
      ]
    },
    exercises: [
      { name: 'Barbell Deadlift', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [50, 50, 60] },
      { name: 'Leg Press', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [55, 60, 60] },
      { name: 'Barbell Reverse Lunge: Left', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [40, 40, 50] },
      { name: 'Barbell Reverse Lunge: Right', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [40, 40, 50] },
      { name: 'Machine Leg Extension', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [50, 50, 50] },
      { name: 'Machine Hamstring Curls', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Seated Machine Calf Raise', targetGroup: 'LEGS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [15, 15, 15] },
    ],
    core: [
      { name: 'Side Plank Reachthrough: Left', defaultSets: 3, durationSecs: 30 },
      { name: 'Side Plank Reachthrough: Right', defaultSets: 3, durationSecs: 30 },
      { name: 'Bicycle Crunches', defaultSets: 3, defaultReps: [12, 10, 8] },
    ],
    stretch: [
      { name: 'Hamstring Stretch', durationSecs: 40 },
      { name: "Child's Pose", durationSecs: 40 },
      { name: 'Prone Quad Stretch: Left', durationSecs: 40 },
      { name: 'Prone Quad Stretch: Right', durationSecs: 40 },
      { name: 'Butterfly Stretch', durationSecs: 40 },
    ]
  },


  // ============================================
  // SHOULDERS WORKOUT
  // ============================================
  {
    id: 'shoulders-1',
    name: 'Shoulders',
    category: 'SHOULDERS',
    focusAreas: ['SHOULDERS'],
    warmUp: {
      cardio: { name: 'Cross Trainer', durationMins: 10 },
      circuit: [
        { name: "World's Greatest Stretch: Left", reps: 10 },
        { name: "World's Greatest Stretch: Right", reps: 10 },
        { name: 'Cat Camel', reps: 15 },
        { name: 'Deltoid Circles', durationSecs: 45 },
        { name: 'Footfires', durationSecs: 45 },
      ]
    },
    exercises: [
      { name: 'Pike Push Up', targetGroup: 'SHOULDERS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Seated Military Press', targetGroup: 'SHOULDERS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Dumbbell Side Lateral Raises', targetGroup: 'SHOULDERS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [10, 10, 10] },
      { name: 'Bent Over Y Raise', targetGroup: 'SHOULDERS', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Dumbbell Alternating Front Raise', targetGroup: 'SHOULDERS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [15, 15, 20] },
      { name: 'Dumbbell Shrug', targetGroup: 'SHOULDERS', defaultSets: 3, defaultReps: [12, 10, 8], defaultWeight: [40, 45, 45] },
    ],
    core: [
      { name: 'Low Plank', defaultSets: 3, durationSecs: 30 },
      { name: 'Dead Bug', defaultSets: 3, defaultReps: [12, 10, 8] },
      { name: 'Weighted Sit Ups', defaultSets: 3, defaultReps: [12, 10, 8] },
    ],
    stretch: [
      { name: 'Sphinx Stretch', durationSecs: 40 },
      { name: 'Lateral Neck Stretch: Left', durationSecs: 40 },
      { name: 'Lateral Neck Stretch: Right', durationSecs: 40 },
      { name: 'Pec Stretch', durationSecs: 40 },
      { name: 'Downward Dog', durationSecs: 40 },
    ]
  },
];
