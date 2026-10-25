// Semantic icon registry. Each glyph is deep-imported: importing values from the
// 'phosphor-react-native' root would bundle all ~1,500 icons (Metro can't tree-shake).
import type { ComponentType } from 'react';
import type { IconProps as PhosphorIconProps } from 'phosphor-react-native';
import { ArrowClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { ArrowUpRightIcon } from 'phosphor-react-native/src/icons/ArrowUpRight';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { ArrowsHorizontalIcon } from 'phosphor-react-native/src/icons/ArrowsHorizontal';
import { BarbellIcon } from 'phosphor-react-native/src/icons/Barbell';
import { BaseballCapIcon } from 'phosphor-react-native/src/icons/BaseballCap';
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { BinocularsIcon } from 'phosphor-react-native/src/icons/Binoculars';
import { BrainIcon } from 'phosphor-react-native/src/icons/Brain';
import { BroadcastIcon } from 'phosphor-react-native/src/icons/Broadcast';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CalendarCheckIcon } from 'phosphor-react-native/src/icons/CalendarCheck';
import { CalendarDotsIcon } from 'phosphor-react-native/src/icons/CalendarDots';
import { CalendarPlusIcon } from 'phosphor-react-native/src/icons/CalendarPlus';
import { CalendarXIcon } from 'phosphor-react-native/src/icons/CalendarX';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
import { ChartLineDownIcon } from 'phosphor-react-native/src/icons/ChartLineDown';
import { ChartLineUpIcon } from 'phosphor-react-native/src/icons/ChartLineUp';
import { ChatCircleDotsIcon } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ChecksIcon } from 'phosphor-react-native/src/icons/Checks';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { CircleDashedIcon } from 'phosphor-react-native/src/icons/CircleDashed';
import { ClipboardTextIcon } from 'phosphor-react-native/src/icons/ClipboardText';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { ClockCountdownIcon } from 'phosphor-react-native/src/icons/ClockCountdown';
import { ClockCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ClockCounterClockwise';
import { CloudSunIcon } from 'phosphor-react-native/src/icons/CloudSun';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { CoinIcon } from 'phosphor-react-native/src/icons/Coin';
import { ColumnsIcon } from 'phosphor-react-native/src/icons/Columns';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { CricketIcon } from 'phosphor-react-native/src/icons/Cricket';
import { CrownIcon } from 'phosphor-react-native/src/icons/Crown';
import { CurrencyInrIcon } from 'phosphor-react-native/src/icons/CurrencyInr';
import { EggIcon } from 'phosphor-react-native/src/icons/Egg';
import { EnvelopeSimpleIcon } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { FireIcon } from 'phosphor-react-native/src/icons/Fire';
import { FlagIcon } from 'phosphor-react-native/src/icons/Flag';
import { FlagBannerIcon } from 'phosphor-react-native/src/icons/FlagBanner';
import { FloppyDiskIcon } from 'phosphor-react-native/src/icons/FloppyDisk';
import { FunnelIcon } from 'phosphor-react-native/src/icons/Funnel';
import { GaugeIcon } from 'phosphor-react-native/src/icons/Gauge';
import { HandGrabbingIcon } from 'phosphor-react-native/src/icons/HandGrabbing';
import { HandWavingIcon } from 'phosphor-react-native/src/icons/HandWaving';
import { HandsClappingIcon } from 'phosphor-react-native/src/icons/HandsClapping';
import { HandshakeIcon } from 'phosphor-react-native/src/icons/Handshake';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { LightbulbIcon } from 'phosphor-react-native/src/icons/Lightbulb';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { LinkSimpleIcon } from 'phosphor-react-native/src/icons/LinkSimple';
import { MagicWandIcon } from 'phosphor-react-native/src/icons/MagicWand';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MapPinLineIcon } from 'phosphor-react-native/src/icons/MapPinLine';
import { MapTrifoldIcon } from 'phosphor-react-native/src/icons/MapTrifold';
import { MedalIcon } from 'phosphor-react-native/src/icons/Medal';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { MoonStarsIcon } from 'phosphor-react-native/src/icons/MoonStars';
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow';
import { PersonSimpleRunIcon } from 'phosphor-react-native/src/icons/PersonSimpleRun';
import { PhoneCallIcon } from 'phosphor-react-native/src/icons/PhoneCall';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { ProhibitIcon } from 'phosphor-react-native/src/icons/Prohibit';
import { RankingIcon } from 'phosphor-react-native/src/icons/Ranking';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { RocketLaunchIcon } from 'phosphor-react-native/src/icons/RocketLaunch';
import { SealIcon } from 'phosphor-react-native/src/icons/Seal';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SmileySadIcon } from 'phosphor-react-native/src/icons/SmileySad';
import { SmileyXEyesIcon } from 'phosphor-react-native/src/icons/SmileyXEyes';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { StarFourIcon } from 'phosphor-react-native/src/icons/StarFour';
import { StrategyIcon } from 'phosphor-react-native/src/icons/Strategy';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { SunHorizonIcon } from 'phosphor-react-native/src/icons/SunHorizon';
import { TShirtIcon } from 'phosphor-react-native/src/icons/TShirt';
import { TargetIcon } from 'phosphor-react-native/src/icons/Target';
import { TelegramLogoIcon } from 'phosphor-react-native/src/icons/TelegramLogo';
import { TennisBallIcon } from 'phosphor-react-native/src/icons/TennisBall';
import { TicketIcon } from 'phosphor-react-native/src/icons/Ticket';
import { TimerIcon } from 'phosphor-react-native/src/icons/Timer';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { TrophyIcon } from 'phosphor-react-native/src/icons/Trophy';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { WallIcon } from 'phosphor-react-native/src/icons/Wall';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WhatsappLogoIcon } from 'phosphor-react-native/src/icons/WhatsappLogo';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle';
import { CricketBallIcon } from './icons/CricketBallIcon';

export const icons = {
  home: HouseIcon,
  find: BinocularsIcon,
  stats: ChartBarIcon,
  team: UsersThreeIcon,
  calendar: CalendarDotsIcon,
  back: CaretLeftIcon,
  forward: CaretRightIcon,
  chevronDown: CaretDownIcon,
  chevronUp: CaretUpIcon,
  arrowLeft: ArrowLeftIcon,
  arrowRight: ArrowRightIcon,
  external: ArrowUpRightIcon,
  close: XIcon,
  closeCircle: XCircleIcon,
  add: PlusIcon,
  addCircle: PlusCircleIcon,
  minus: MinusIcon,
  trash: TrashIcon,
  link: LinkSimpleIcon,
  paste: ClipboardTextIcon,
  copy: CopyIcon,
  refresh: ArrowClockwiseIcon,
  autoRefresh: ArrowsClockwiseIcon,
  search: MagnifyingGlassIcon,
  history: ClockCounterClockwiseIcon,
  idea: LightbulbIcon,
  filter: FunnelIcon,
  check: CheckIcon,
  checkCircle: CheckCircleIcon,
  checks: ChecksIcon,
  info: InfoIcon,
  warning: WarningCircleIcon,
  share: ShareNetworkIcon,
  save: FloppyDiskIcon,
  dot: CircleIcon,
  phone: PhoneCallIcon,
  whatsapp: WhatsappLogoIcon,
  email: EnvelopeSimpleIcon,
  telegram: TelegramLogoIcon,
  comment: ChatCircleDotsIcon,
  pin: MapPinIcon,
  map: MapTrifoldIcon,
  directions: NavigationArrowIcon,
  city: BuildingsIcon,
  address: MapPinLineIcon,
  views: EyeIcon,
  stadium: FlagBannerIcon,
  ticket: TicketIcon,
  clock: ClockIcon,
  timer: TimerIcon,
  countdown: ClockCountdownIcon,
  calendarBlank: CalendarBlankIcon,
  calendarAdd: CalendarPlusIcon,
  calendarCheck: CalendarCheckIcon,
  calendarRemove: CalendarXIcon,
  morning: SunIcon,
  afternoon: CloudSunIcon,
  evening: SunHorizonIcon,
  night: MoonStarsIcon,
  bat: CricketIcon,
  ball: CricketBallIcon,
  tennis: TennisBallIcon,
  round: FlagIcon,
  trophy: TrophyIcon,
  medal: MedalIcon,
  crown: CrownIcon,
  star: StarIcon,
  sparkle: SparkleIcon,
  highlight: StarFourIcon,
  fire: FireIcon,
  lightning: LightningIcon,
  target: TargetIcon,
  gloves: HandGrabbingIcon,
  shield: ShieldCheckIcon,
  runOut: PersonSimpleRunIcon,
  stumping: ColumnsIcon,
  duck: EggIcon,
  hatTrick: MagicWandIcon,
  noBall: ProhibitIcon,
  wide: ArrowsHorizontalIcon,
  maiden: WallIcon,
  dots: CircleDashedIcon,
  toss: CoinIcon,
  hands: HandshakeIcon,
  loss: SmileySadIcon,
  innings: BaseballCapIcon,
  century: SealIcon,
  rocket: RocketLaunchIcon,
  chart: ChartLineUpIcon,
  chartDown: ChartLineDownIcon,
  runRate: GaugeIcon,
  ranking: RankingIcon,
  live: BroadcastIcon,
  clap: HandsClappingIcon,
  strength: BarbellIcon,
  wave: HandWavingIcon,
  strategy: StrategyIcon,
  money: CurrencyInrIcon,
  card: CreditCardIcon,
  receipt: ReceiptIcon,
  jersey: TShirtIcon,
  celebrate: ConfettiIcon,
  restDay: CoffeeIcon,
  sleepy: BedIcon,
  oops: SmileyXEyesIcon,
  ai: BrainIcon,
  user: UserCircleIcon,
} satisfies Record<string, ComponentType<PhosphorIconProps>>;

export type IconName = keyof typeof icons;
