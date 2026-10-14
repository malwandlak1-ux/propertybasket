/** A step-by-step help article shown in a dashboard's Help & Support page. */
export type Guide = {
    id: string;
    category: string;
    title: string;
    summary: string;
    steps: string[];
    tips?: string[];
    /** Shortcut to the screen the guide is about. */
    link?: { label: string; href: string };
};
