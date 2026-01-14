Based on your existing DESIGN.md and our discussion about your specific training schedule (Cardio \-\> Strength \-\> Core), here is the Feature Specification for the **Gym Diary Module**.

This module is designed to replace your Google Keep workflow while integrating with your Match/Practice schedule.

# ---

**Feature Spec: Gym Diary & Fitness Tracker**

## **1\. Overview**

The **Gym Diary** is a new module within *MyCoach* designed to manage the user's "Cricketer’s Edge" training schedule. It allows the user to log workouts with a specific flow (Cardio → Strength → Core), track progressive overload, and visualize training days alongside Match days.

## **2\. User Flow & Core Requirements**

### **2.1 The Daily Workflow**

The module must support the user's specific sequence:

1. **Pre-Workout:** View today's planned focus (e.g., "Legs & Shoulders").  
2. **Phase 1 \- Cardio:** Log running duration and speed/distance.  
3. **Phase 2 \- Strength:** Log Sets, Reps, and Weight for specific exercises.  
4. **Phase 3 \- Core:** Checklist or rep logger for core finishers.

### **2.2 Dynamic Scheduling**

* **Conflict Awareness:** The system must highlight if a user schedules "Leg Day" the day before a "Match Day" (fetched from existing Match entities) and warn them.  
* **Variable Schedule:** Allow swapping workout days easily (e.g., swapping Wednesday's Gym session if a Match is scheduled).

## **3\. Data Architecture Changes**

### **3.1 New Data Types (src/types/fitness.ts)**

We need new interfaces to handle local workout data.

TypeScript

// Enums for your specific split  
export type MuscleGroup \= 'LEGS' | 'SHOULDERS' | 'CHEST' | 'TRICEPS' | 'BACK' | 'BICEPS' | 'CORE' | 'CARDIO';

export interface ExerciseSet {  
  id: string;  
  weight: number; // in kg  
  reps: number;  
  completed: boolean;  
}

export interface ExerciseLog {  
  id: string;  
  exerciseName: string; // e.g., "Barbell Squats"  
  targetGroup: MuscleGroup;  
  sets: ExerciseSet\[\];  
  notes?: string;  
}

export interface CardioLog {  
  type: 'RUNNING' | 'SWIMMING' | 'CYCLING';  
  durationMinutes: number;  
  distanceKm?: number;  
  intensity: 'LOW' | 'MODERATE' | 'HIGH';  
}

export interface DailyWorkout {  
  id: string; // UUID  
  date: string; // ISO Date "2025-01-02"  
  type: 'GYM' | 'PRACTICE' | 'MATCH' | 'REST';  
  focusAreas?: MuscleGroup\[\]; // e.g., \['LEGS', 'SHOULDERS'\]  
  cardio?: CardioLog;  
  exercises: ExerciseLog\[\];  
  isRestDay: boolean;  
}

### **3.2 Storage Strategy**

Unlike match data which is fetched from the API, gym data is **local and personal**.

* **Primary Storage:** AsyncStorage (using @gym\_diary\_logs key).  
* **Structure:** A simple JSON object map keyed by Date strings.

## **4\. UI/UX & Navigation Updates**

### **4.1 Navigation (src/navigation/)**

Add a new Tab to the RootNavigator.

* **Tab Name:** Fitness  
* **Icon:** barbell / barbell-outline (Ionicons)  
* **Target:** FitnessStack

**FitnessStack Screens:**

1. FitnessDashboard: Weekly view and "Start Workout" button.  
2. ActiveWorkoutScreen: The logging interface.  
3. ExerciseHistoryScreen: Charts showing strength progression.

### **4.2 Screen Specifications**

#### **A. Fitness Dashboard (Home for Gym)**

* **Header:** "Road to Match Fitness"  
* **Widget 1: Weekly Snapshot:** A horizontal row of 7 days.  
  * Matches are pulled from calendar service (marked Blue).  
  * Gym days are marked Orange.  
  * Rest days are Grey.  
* **Widget 2: Today's Action:**  
  * If Match Day: Show "Match Day \- Rest & Hydrate".  
  * If Gym Day: Show "Focus: Legs & Shoulders" with a **"Start Workout"** button.

#### **B. Active Workout Screen (The "Google Keep" Replacement)**

This screen replaces the need for notes. It uses a **Step-Wizard** approach:

* **Step 1: Cardio Check-in:**  
  * Input: Time (mins) & Speed/Distance.  
  * *UI:* Large numeric inputs.  
* **Step 2: The Lift (Strength):**  
  * List of exercises based on the day's focus.  
  * *UI:* Accordion list for each exercise.  
  * *Interaction:* "Add Set" button. Input Weight/Reps. Swipe left to delete a set.  
* **Step 3: Core Finisher:**  
  * Simple checkboxes for Plank, Russian Twists, Leg Raises.  
* **Footer:** "Finish Workout" button (Saves to AsyncStorage).

## **5\. Integration with Existing Modules**

### **5.1 Calendar Integration**

The existing CalendarScreen should be updated to show dots for Gym sessions alongside matches.

* **Implementation:** In CalendarScreen.tsx, merge ScheduledMatch data with DailyWorkout data when rendering the calendar dots.

### **5.2 Home Screen Widget**

Add a small card on the main HomeList below the "Upcoming Match" card:

* *Text:* "Next Gym Session: Chest & Triceps (Tomorrow)"

## **6\. Implementation Plan (Phased)**

1. **Phase 1 (Data):** Create FitnessService.ts to handle saving/loading logs from AsyncStorage.  
2. **Phase 2 (UI):** Build the FitnessDashboard and simple logging form.  
3. **Phase 3 (Intelligence):** Add the logic to warn if "Leg Day" is scheduled before "Match Day".

## **7\. Code Snippet: Fitness Service Skeleton**

Create src/services/fitnessService.ts:

TypeScript

import AsyncStorage from '@react-native-async-storage/async-storage';  
import { DailyWorkout } from '../types/fitness';

const STORAGE\_KEY \= '@mycoach\_gym\_logs';

export const FitnessService \= {  
  // Save a completed workout  
  saveWorkout: async (workout: DailyWorkout) \=\> {  
    try {  
      const existingData \= await AsyncStorage.getItem(STORAGE\_KEY);  
      const logs \= existingData ? JSON.parse(existingData) : {};  
      logs\[workout.date\] \= workout;  
      await AsyncStorage.setItem(STORAGE\_KEY, JSON.stringify(logs));  
    } catch (e) {  
      console.error('Failed to save workout', e);  
    }  
  },

  // Get workout for a specific date  
  getWorkoutByDate: async (date: string): Promise\<DailyWorkout | null\> \=\> {  
    try {  
      const data \= await AsyncStorage.getItem(STORAGE\_KEY);  
      const logs \= data ? JSON.parse(data) : {};  
      return logs\[date\] || null;  
    } catch (e) {  
      return null;  
    }  
  }  
};  
