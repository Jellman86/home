export interface PortfolioLink {
    label: string;
    url: string;
    icon: string; // Emoji, used by the text-only Terminal theme
    /** Bundled app favicon. Local so the page makes no third-party requests. */
    iconUrl?: string;
    /** Brand mark drawn inline when the destination has no favicon of its own. */
    iconGlyph?: 'github' | 'linkedin' | 'auspex';
    demoUrl?: string;
    /** Renders as a tile rather than a link. `url` is ignored while set, so an
     *  unreleased project can sit in the grid without a destination to 404 on. */
    status?: 'coming-soon';
    /** Extra detail for a status tile, shown as its title attribute. */
    statusNote?: string;
    /** A link can nominate what the background does while it is hovered. */
    background?: 'macroblocks' | 'auspex';
    /** Shown in the panel's right column while this link has focus. One or two
     *  sentences: it is a caption, not a description. */
    blurb?: string;
}

export interface PortfolioData {
    name: string;
    avatarUrl: string;
    bio: string;
    links: PortfolioLink[];
}
