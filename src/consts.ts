// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Josh Zuo';
export const SITE_DESCRIPTION =
	'Notes from the CLI — a network engineer building, breaking, and automating networks.';

// Handle shown across the site. Edit to taste.
export const AUTHOR = 'Network Engineer';
export const TAGLINE = 'Routing packets & automating the edge.';

// Social / contact links used across the site. Replace with your own.
export const SOCIAL = {
	github: 'https://github.com/chargyzuo',
	linkedin: 'https://www.linkedin.com/',
	email: 'mailto:hello@joshzuonet.cloud',
};

// Navigation categories. `slug` maps to /category/<slug>/,
// `key` matches the `category` field in each post's frontmatter.
export const CATEGORIES = [
	{
		key: 'notes',
		slug: 'notes',
		label: 'Notes & Labs',
		blurb: '学习笔记 · study notes from the CLI.',
	},
	{
		key: 'troubleshooting',
		slug: 'troubleshooting',
		label: 'Troubleshooting',
		blurb: '平时的排障案例 · real-world troubleshooting cases.',
	},
	{
		key: 'automation',
		slug: 'network-automation',
		label: 'Network Automation',
		blurb: '网络自动化目录 · scripts & automation write-ups.',
	},
	{
		key: 'other',
		slug: 'other',
		label: 'Other',
		blurb: '其他 · everything else.',
	},
] as const;
