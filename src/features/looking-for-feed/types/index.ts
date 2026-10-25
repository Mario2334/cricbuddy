// Core TypeScript interfaces for the Looking For feed feature

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  PROFESSIONAL = 'professional'
}

export enum TeamType {
  CASUAL = 'casual',
  COMPETITIVE = 'competitive',
  TOURNAMENT = 'tournament',
  LEAGUE = 'league'
}

export enum BallType {
  LEATHER = 'leather',
  TENNIS = 'tennis',
  RUBBER = 'rubber',
  PLASTIC = 'plastic'
}

export enum GroundType {
  TURF = 'turf',
  MATTING = 'matting',
  CONCRETE = 'concrete',
  GRASS = 'grass'
}

export enum MatchFormat {
  T20 = 't20',
  ODI = 'odi',
  TEST = 'test',
  T10 = 't10',
  HUNDRED = 'hundred'
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  whatsapp?: string;
  telegram?: string;
}

export interface UserInfo {
  id: string;
  name: string;
  profilePhoto: string;
  contactDetails: ContactInfo;
  rating?: number;
}

export interface TeamRequirements {
  positionsNeeded: string[];
  skillLevel: SkillLevel;
  teamType: TeamType;
  description: string;
}

export interface MatchDetails {
  ballType: BallType;
  groundType: GroundType;
  matchFormat: MatchFormat;
  comments: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  cityId: number;
  cityName: string;
  venue?: string;
}

export interface TimeSlot {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

export interface RecurringSchedule {
  daysOfWeek: number[]; // 0-6, Sunday = 0
  frequency: 'weekly' | 'biweekly' | 'monthly';
  duration?: number; // in weeks/months
}

export interface TimingInfo {
  isLongTerm: boolean;
  specificDates?: Date[];
  recurringSchedule?: RecurringSchedule;
  preferredTimes: TimeSlot[];
}

export interface RecruitmentPost {
  id: string;
  user: UserInfo;
  requirements: TeamRequirements;
  matchDetails: MatchDetails;
  location: LocationData;
  timing: TimingInfo;
  createdAt: Date;
  updatedAt: Date;
  /** Human "posted" label straight from the API (e.g. "5 mins ago"), when provided. */
  timeAgo?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface TimeRange {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

export interface PostFilters {
  positions?: string[];
  dates?: DateRange;
  times?: TimeRange;
  locations?: string[];
  skillLevels?: SkillLevel[];
}

export interface AIQuery {
  rawQuery: string;
  processedFilters: PostFilters;
  confidence: number;
  suggestions?: string[];
  modelUsed?: string;
  fallbackAttempts?: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  priority: number;
  maxRetries: number;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  models: ModelConfig[];
}