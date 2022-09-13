export const hexurl = './data/lad-2021.json';
export const adjurl = './data/lad-2021-adj.json';
export const dataurl = './data/datasets-2021.csv';

export const routes = [
	{
		label: "Select route on map",
		code: "map"
	},
	{
		label: "Random route",
		code: "random"
	},
	{
		label: "Daily route",
		code: "daily"
	}
];

export const datasets = [
	{
		label: "Total population",
		code: "population",
		unit: "people"
	},
	{
		label: "Population density",
		code: "density",
		unit: "people per square km"
	},
	{
		label: "Area in square km",
		label_long: "Area in square kilometres",
		code: "area",
		unit: "square km"
	}
];

export const modes = [
	{
		label: "Daily",
		code: "daily"
	},
	{
		label: "Regular",
		code: "classic"
	},
	{
		label: "Beat the clock",
		code: "timed"
	},
	// {
	// 	label: "Fixed route",
	// 	code: "fixed"
	// }
];

export const game_defaults = {
	mode: "daily",
	dataset: "population",
  route: "daily",
	start: null,
	end: null,
  next: null,
  bearing: null,
  selected: null,
  steps: [], // Pre-defined/shortest route
  right: [], // Array of place codes correctly guessed
  wrong: [], // Array of place codes wrongly guessed
	record: [] // Array of true/false for order of right/wrong answers
};

export const history_defaults = {
	daily: {
		day: null,
		game: null,
		result: null
	},
	stats: Object.fromEntries(modes.map(mode => [
		mode.code,
		{
			won: 0,
			lost: 0,
			streak: 0,
			streak_max: 0,
			right: 0,
			wrong: 0
		}]
	)),
	hexes : {}
};

export const sample_hexes = [
  "E08000025",
  "E07000234",
  "E07000192",
  "E08000026",
  "E08000027",
  "E06000019",
  "E07000235",
  "E07000218",
  "E07000219",
  "E07000236",
  "E07000220",
  "E08000028",
  "E06000051",
  "E08000029",
  "E07000196",
  "E07000221",
  "E06000020",
  "E08000030",
  "E07000222",
  "E08000031",
  "E07000237",
  "E07000238",
  "E07000239"
]