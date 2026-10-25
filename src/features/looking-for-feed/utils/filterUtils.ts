/**
 * Filter Utility Functions for Looking For Feed
 * 
 * This module contains utility functions for applying various types of filters
 * to recruitment posts, including position, date, time, location, and skill level filters.
 */

import { 
  RecruitmentPost, 
  PostFilters, 
  SkillLevel,
  DateRange,
  TimeRange 
} from '../types';

/**
 * Apply all filters to a collection of recruitment posts
 */
export function applyAllFilters(
  posts: RecruitmentPost[], 
  filters: PostFilters
): RecruitmentPost[] {
  if (!posts || posts.length === 0) {
    return [];
  }

  return posts.filter(post => matchesAllFilters(post, filters));
}

/**
 * Check if a post matches all specified filters
 */
export function matchesAllFilters(post: RecruitmentPost, filters: PostFilters): boolean {
  // Position filtering
  if (filters.positions && filters.positions.length > 0) {
    if (!matchesPositionFilter(post, filters.positions)) {
      return false;
    }
  }

  // Date filtering
  if (filters.dates) {
    if (!matchesDateFilter(post, filters.dates)) {
      return false;
    }
  }

  // Time filtering
  if (filters.times) {
    if (!matchesTimeFilter(post, filters.times)) {
      return false;
    }
  }

  // Location filtering
  if (filters.locations && filters.locations.length > 0) {
    if (!matchesLocationFilter(post, filters.locations)) {
      return false;
    }
  }

  // Skill level filtering
  if (filters.skillLevels && filters.skillLevels.length > 0) {
    if (!matchesSkillLevelFilter(post, filters.skillLevels)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if post matches position filter
 */
export function matchesPositionFilter(post: RecruitmentPost, positions: string[]): boolean {
  return positions.some(position => 
    post.requirements.positionsNeeded.some(needed => 
      needed.toLowerCase().includes(position.toLowerCase()) ||
      position.toLowerCase().includes(needed.toLowerCase())
    )
  );
}

/**
 * Check if post matches date filter
 */
export function matchesDateFilter(post: RecruitmentPost, dateFilter: DateRange): boolean {
  const { startDate, endDate } = dateFilter;
  
  // For long-term posts, check if the date range overlaps
  if (post.timing.isLongTerm) {
    // Long-term posts are generally available, so they match most date queries
    return true;
  }

  // For specific date posts
  if (post.timing.specificDates && post.timing.specificDates.length > 0) {
    return post.timing.specificDates.some(postDate => {
      const postDateTime = new Date(postDate);
      const filterStart = new Date(startDate);
      const filterEnd = new Date(endDate);
      
      return postDateTime >= filterStart && postDateTime <= filterEnd;
    });
  }

  // If no specific dates, assume it's available (fallback for data quality issues)
  return true;
}

/**
 * Check if post matches time filter
 */
export function matchesTimeFilter(post: RecruitmentPost, timeFilter: TimeRange): boolean {
  const { startTime, endTime } = timeFilter;
  
  if (!post.timing.preferredTimes || post.timing.preferredTimes.length === 0) {
    // If no preferred times specified, assume it matches (fallback)
    return true;
  }

  return post.timing.preferredTimes.some(timeSlot => {
    // Check if there's any overlap between filter time range and post time slot
    return timeRangesOverlap(
      { startTime, endTime },
      { startTime: timeSlot.startTime, endTime: timeSlot.endTime }
    );
  });
}

/**
 * Check if post matches location filter
 */
export function matchesLocationFilter(post: RecruitmentPost, locations: string[]): boolean {
  return locations.some(location =>
    post.location.cityName.toLowerCase().includes(location.toLowerCase()) ||
    (post.location.venue && post.location.venue.toLowerCase().includes(location.toLowerCase()))
  );
}

/**
 * Check if post matches skill level filter
 */
export function matchesSkillLevelFilter(post: RecruitmentPost, skillLevels: SkillLevel[]): boolean {
  return skillLevels.includes(post.requirements.skillLevel);
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const start1 = timeToMinutes(range1.startTime);
  const end1 = timeToMinutes(range1.endTime);
  const start2 = timeToMinutes(range2.startTime);
  const end2 = timeToMinutes(range2.endTime);

  return start1 < end2 && start2 < end1;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get filter statistics for a collection of posts
 */
export function getFilterStatistics(
  originalPosts: RecruitmentPost[],
  filteredPosts: RecruitmentPost[],
  filters: PostFilters
): FilterStatistics {
  return {
    totalPosts: originalPosts.length,
    filteredPosts: filteredPosts.length,
    filterEfficiency: originalPosts.length > 0 ? filteredPosts.length / originalPosts.length : 0,
    appliedFilters: {
      hasPositionFilter: !!(filters.positions && filters.positions.length > 0),
      hasDateFilter: !!filters.dates,
      hasTimeFilter: !!filters.times,
      hasLocationFilter: !!(filters.locations && filters.locations.length > 0),
      hasSkillLevelFilter: !!(filters.skillLevels && filters.skillLevels.length > 0),
    },
    filterCounts: {
      positions: filters.positions?.length || 0,
      locations: filters.locations?.length || 0,
      skillLevels: filters.skillLevels?.length || 0,
    }
  };
}

/**
 * Validate filter values
 */
export function validateFilters(filters: PostFilters): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate positions
  if (filters.positions) {
    if (filters.positions.length === 0) {
      warnings.push('Empty positions array provided');
    }
    
    const validPositions = ['batsman', 'bowler', 'wicket-keeper', 'all-rounder'];
    const invalidPositions = filters.positions.filter(pos => 
      !validPositions.some(valid => 
        pos.toLowerCase().includes(valid) || valid.includes(pos.toLowerCase())
      )
    );
    
    if (invalidPositions.length > 0) {
      warnings.push(`Unrecognized positions: ${invalidPositions.join(', ')}`);
    }
  }

  // Validate dates
  if (filters.dates) {
    const { startDate, endDate } = filters.dates;
    
    if (isNaN(startDate.getTime())) {
      errors.push('Invalid start date');
    }
    
    if (isNaN(endDate.getTime())) {
      errors.push('Invalid end date');
    }
    
    if (startDate.getTime() > endDate.getTime()) {
      errors.push('Start date must be before or equal to end date');
    }
    
    // Check if dates are too far in the past or future
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    
    if (endDate < oneYearAgo) {
      warnings.push('Date range is more than a year in the past');
    }
    
    if (startDate > oneYearFromNow) {
      warnings.push('Date range is more than a year in the future');
    }
  }

  // Validate times
  if (filters.times) {
    const { startTime, endTime } = filters.times;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(startTime)) {
      errors.push('Invalid start time format (expected HH:MM)');
    }
    
    if (!timeRegex.test(endTime)) {
      errors.push('Invalid end time format (expected HH:MM)');
    }
    
    if (timeRegex.test(startTime) && timeRegex.test(endTime)) {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      if (startMinutes >= endMinutes) {
        errors.push('Start time must be before end time');
      }
    }
  }

  // Validate locations
  if (filters.locations) {
    if (filters.locations.length === 0) {
      warnings.push('Empty locations array provided');
    }
    
    const emptyLocations = filters.locations.filter(loc => !loc || loc.trim().length === 0);
    if (emptyLocations.length > 0) {
      warnings.push('Some location filters are empty');
    }
  }

  // Validate skill levels
  if (filters.skillLevels) {
    if (filters.skillLevels.length === 0) {
      warnings.push('Empty skill levels array provided');
    }
    
    const validSkillLevels = Object.values(SkillLevel);
    const invalidSkillLevels = filters.skillLevels.filter(level => 
      !validSkillLevels.includes(level)
    );
    
    if (invalidSkillLevels.length > 0) {
      errors.push(`Invalid skill levels: ${invalidSkillLevels.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Supporting interfaces
export interface FilterStatistics {
  totalPosts: number;
  filteredPosts: number;
  filterEfficiency: number; // 0-1, ratio of filtered to total posts
  appliedFilters: {
    hasPositionFilter: boolean;
    hasDateFilter: boolean;
    hasTimeFilter: boolean;
    hasLocationFilter: boolean;
    hasSkillLevelFilter: boolean;
  };
  filterCounts: {
    positions: number;
    locations: number;
    skillLevels: number;
  };
}

export interface FilterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}