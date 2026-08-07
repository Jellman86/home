export interface PortfolioLink {
    label: string;
    url: string;
    icon: string; // Emoji, used by the text-only Terminal theme
    /** Bundled app favicon. Local so the page makes no third-party requests. */
    iconUrl?: string;
    /** Brand mark drawn inline when the destination has no favicon of its own. */
    iconGlyph?: 'github' | 'linkedin';
    demoUrl?: string;
}

export interface PortfolioData {
    name: string;
    avatarUrl: string;
    bio: string;
    links: PortfolioLink[];
}
