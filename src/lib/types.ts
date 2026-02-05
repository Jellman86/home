export interface PortfolioLink {
    label: string;
    url: string;
    icon: string; // Emoji or SVG string
}

export interface PortfolioData {
    name: string;
    avatarUrl: string;
    bio: string;
    links: PortfolioLink[];
}
