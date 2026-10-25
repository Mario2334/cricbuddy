import type { IconTone } from '../../theme';
import type { IconName } from '../../ui/icons';
import type { HomeSegment } from '../../hooks/useHomeMatches';

export const EMPTY_COPY: Record<HomeSegment, { icon: IconName; tone: IconTone; title: string; message: string }> = {
  upcoming: {
    icon: 'calendarAdd',
    tone: 'emerald',
    title: 'No upcoming matches',
    message: 'Your fixture list is emptier than a dropped catch. Add one!',
  },
  live: {
    icon: 'live',
    tone: 'rose',
    title: 'Nothing live right now',
    message: "The pitch is quiet. We'll light this up when the toss happens.",
  },
  past: {
    icon: 'trophy',
    tone: 'amber',
    title: 'No past matches yet',
    message: 'Every legend starts with the first ball.',
  },
};

export const ERROR_COPY = { icon: 'oops' as IconName, title: 'Dropped catch!' };

export const REST_DAY_COPY = { icon: 'restDay' as IconName, tone: 'teal' as IconTone, title: 'Rest day' };
