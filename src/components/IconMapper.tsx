import {
  BookOpen,
  Calendar,
  Camera,
  Code2,
  Github,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  Mic,
  Music,
  ShoppingBag,
  Sparkles,
  Twitter,
  Video,
  Youtube,
} from 'lucide-react';

export function LinkIcon({
  name,
  className = 'w-5 h-5',
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case 'globe':
      return <Globe className={className} />;
    case 'shopping-bag':
      return <ShoppingBag className={className} />;
    case 'mic':
      return <Mic className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'camera':
      return <Camera className={className} />;
    case 'calendar':
      return <Calendar className={className} />;
    case 'mail':
      return <Mail className={className} />;
    case 'code':
      return <Code2 className={className} />;
    case 'music':
      return <Music className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'link':
    default:
      return <Link2 className={className} />;
  }
}

export function SocialIcon({
  platform,
  className = 'w-5 h-5',
}: {
  platform: string;
  className?: string;
}) {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <Instagram className={className} />;
    case 'twitter':
    case 'x':
      return <Twitter className={className} />;
    case 'youtube':
      return <Youtube className={className} />;
    case 'github':
      return <Github className={className} />;
    case 'linkedin':
      return <Linkedin className={className} />;
    case 'mail':
      return <Mail className={className} />;
    case 'tiktok':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'globe':
    default:
      return <Globe className={className} />;
  }
}
