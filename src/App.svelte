<script>
	import { format } from "d3-format";
	import { renderHexJSON } from "./lib/hexjson";
	import Random from "./lib/random";
	import { getData, getAngle, getCompass, calcSteps, sleep, getStorage, setStorage, getPNG } from "./utils";
	import { hexurl, adjurl, dataurl, game_defaults, history_defaults, routes, datasets, modes, sample_hexes } from "./config";
	import tooltip from "./ui/tooltip";
	import HexMap from "./vis/HexMap.svelte";
	import Legend from "./vis/Legend.svelte";
	import Bar from "./vis/Bar.svelte";
	import Icon from "./ui/Icon.svelte";
	import Select from "./ui/Select.svelte";
	import ONSLogo from "./ui/ONSLogo.svelte";
	import CensusLogo from "./ui/CensusLogo.svelte";

	// Hexmap settings
	const width = 800;
	const height = 1000;
	const adjdist = 32.653; // Pixel distance between two adjacent hexes

	// Constants for calculating daily game. 28 June 2022 is daily game #1
	const zeroday = Math.floor(new Date("2022-06-27").setHours(0,0,0,0) / (60 * 60 * 24 * 1000));
	const today = Math.floor(new Date().setHours(0,0,0,0) / (60 * 60 * 24 * 1000));
	const midnight = new Date().setHours(24,0,0,0);

	// Initialise number formatter. Zero decimal places, 1,000s comma separated
	const f = format(",.0f");

	// Countdown in seconds to next daily game
	let countdown;
	setInterval(() => {
		let cd = midnight - new Date();
		countdown = cd < 0 ? 0 : cd;
	}, 1000);

	// DOM
	let el = {}; // For binding DOM elements to keys
	let mapel; // DOM element for map container
	let maphexes; // Keyed DOM elements for individual map hexes (used for scrolling into view)
	let qhigher, qlower; // "Higher" and "Lower" buttons, for focus

	// DATA
	let data; // Keyed object with data per LAD
	let hexes; // Array of hexagon geometries + metadata per LAD
	let nexthexes = []; // Adjacent hexes for selection
	let adj; // Keyed object with adjacencies per LAD code

	// GAME STATE
	let fullscreen = false; // true if game is showing full screen
	let status = "mode"; // mode, dataset, route, select, question, lost, won, info, scores
	let status_prev = [];
	let game = JSON.parse(JSON.stringify(game_defaults));
	let history; // Game history (synced with localStorage)
	let clock = 0; // Number of seconds on game clock (for "timed" mode)
	let timer; // Variable for clock setInterval / clearInterval
	let message_guess = ""; // Message for correct/incorrect guesses
	let message_select = null; // Message for selection of areas on map

	function setHexes() {
		let nexthexes_new = [];
		hexes.forEach((d) => {
			d.direction = null;

			//if the place is the same as the entry - mark as selected
			if (["S", "N"].includes(d.key.slice(0,1))){
				d.status = "disabled";
			} else if (game.selected && d.key == game.selected.key) {
				d.status = "selected";
			} else if (game.next && d.key == game.next.key) {
				d.status = "next";
			} else if (game.wrong.includes(d.key)) {
				d.status = "wrong";
			} else if (game.right.includes(d.key)) {
				if (d.key == game.end) {
					d.status = "end";
				} else { 
					d.status = "right"; //'right' meaning correct
				}
			} else if (status == "select" && game.selected.adj.includes(d.key)) {
				d.status = "adjacent";
				d.direction = getCompass(getAngle(d.x - game.selected.x, game.selected.y - d.y));
				nexthexes_new.push(d);
			} else if (d.key == game.end) {
				d.status = "end";
			} else if (d.key == game.start) {
				d.status = "start";
			} else if ((status == "route" || game.mode == "fixed") && game.steps.includes(d.key)) {
				d.status = "route";
			} else if (status == "route" && !(game.start && game.end)) {
				d.status = "selectable";
			} else {
				d.status = "";
			}
		});
		hexes = [...hexes];

		// Sort array of adjacent hexes clockwise, starting with next step towards finish
		// This is for keyboard navigation of adjacent hexes
		if (nexthexes_new[1]) {
			let nexthexes_sorted = [];
			const compass = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
			let hexbearings = nexthexes_new.map(d => getCompass(getAngle(d.x - game.selected.x, game.selected.y - d.y)));
			let nextstep = calcSteps(game.selected.key, game.end, adj, [...game.right, ...game.wrong])[1];
			let nextbearing = hexbearings[nexthexes_new.map(d => d.key).indexOf(nextstep)];
			for (let i = 0; i < compass.length; i ++) {
				let thisbearing = compass[(i + compass.indexOf(nextbearing)) % compass.length];
				let thisindex = hexbearings.indexOf(thisbearing);
				if (thisindex > -1) {
					nexthexes_sorted.push(nexthexes_new[thisindex]);
				}
			}
			nexthexes = nexthexes_sorted;
		} else {
			nexthexes = nexthexes_new;
		};

		if (nexthexes[0]) {
			message_select = `Destination is ${getCompass(game.bearing)}. Press left of right to select next place.`
		} else {
			message_select = null;
		}
	}

	async function doSelect(e) {
		if (status == "select" && game.selected.adj.includes(e.detail.obj.key) && !game.wrong.includes(e.detail.obj.key)) {
			game.next = e.detail.obj;
			status = "question";
			await sleep(50);
			setHexes();
			await sleep(50);
			qhigher.focus();
		} else if (status == "route" && game.route == "map") {
			if (!game.start) {
				game.start = e.detail.obj.key;
			} else if (!game.end) {
				game.end = e.detail.obj.key;
			}
			if (game.start && game.end) {
				game.steps = calcSteps(game.start, game.end, adj);
			} else {
				game.steps = [];
			}
			await sleep(50);
			setHexes();
		}
	}

	async function guess(hl, e) {
		if (
			(hl == "higher" && data[game.next.key][game.dataset] >= data[game.selected.key][game.dataset]) ||
			(hl == "lower" && data[game.next.key][game.dataset] <= data[game.selected.key][game.dataset])
		) {
			e.target.style["background-color"] = "#22D0B6";
			message_guess = "Correct!";
			await sleep(750);
			game.right.push(game.next.key);
			game.record.push(true);
			history.stats[game.mode].right += 1;
			history.hexes[game.next.key].r += 1;

			if (game.next.key == game.end) {
				status = "won";
				history.stats[game.mode].won += 1;
				history.stats[game.mode].streak += 1;
				if (history.stats[game.mode].streak > history.stats[game.mode].streak_max) history.stats[game.mode].streak_max += 1;

				if (game.mode == "daily") {
					history.daily.result = "won";
				}
				if (game.mode == "timed") {
					clearInterval(timer);
				}
			} else {
				game.selected = game.next;
				status = "select";
			}
		} else {
			e.target.style["background-color"] = "#F66068";
			message_guess = "Wrong..."
			await sleep(750);
			game.wrong.push(game.next.key);
			game.record.push(false);
			history.stats[game.mode].wrong += 1;
			history.hexes[game.next.key].w += 1;

			let adjacent = hexes.filter((d) => game.selected.adj.includes(d.key));
			adjacent = adjacent.filter(
				(d) => !game.wrong.includes(d.key) && !game.right.includes(d.key)
			);
			if (!adjacent[0] || !calcSteps(game.selected.key, game.end, adj, [...game.right, ...game.wrong]) || game.next.key == game.end) {
				status = "lost";
				history.stats[game.mode].lost += 1;
				history.stats[game.mode].streak = 0;

				if (game.mode == "daily") {
					history.daily.result = "lost";
				}
				if (game.mode == "timed") {
					clearInterval(timer);
				}
			} else {
				status = "select";
			}
		}

		if (game.mode == "fixed" && status != "won") {
			game.selected = game.next;
			let step = game.steps.indexOf(game.selected.key);
			game.next = step < game.steps.length - 1 ? hexes.find(d => d.key == game.steps[step + 1]) : null;
			status = game.next ? "question" : "won";
		} else {
			game.next = null;
		}

		let end = hexes.find(d => d.key == game.end);
		game.bearing = getAngle(end.x - game.selected.x, game.selected.y - end.y);
		e.target.style["background-color"] = null;
		message_guess = "";
		
		setHexes();
		if (game.mode == "daily") {
			history.daily.game = JSON.parse(JSON.stringify(game));
		}
		setStorage("hexgame-history", history);

		if (status == "select") {
			await sleep(50);
			maphexes["next0"].focus();
		}

		if (status == "won" || status == "lost") {
			dataLayer.push({
				event: "gameStart",
				result: status,
				mode: game.mode,
				dataset: game.dataset,
				start: data[game.start].name,
				end: data[game.end].name
			});
		}
	}

	async function startGame() {
		game.right = [];
		game.wrong = [];
		game.next = game.mode == "fixed" ? hexes.find(d => d.key == game.steps[1]) : null;
		game.selected = hexes.find(d => d.key == game.start);
		game.right.push(game.start);
		status = game.mode == "fixed" ? "question" : "select";

		if (game.mode == "timed") {
			clock = 5 * (game.steps.length - 1);
			timer = setInterval(updateTimer, 1000);
			function updateTimer() {
				clock -= 1;
				if (clock == 0) {
					clearInterval(timer);
					if (status != "won") status = "lost";

					dataLayer.push({
						event: "gameStart",
						result: status,
						mode: game.mode,
						dataset: game.dataset,
						start: data[game.start].name,
						end: data[game.end].name
					});
				}
			}
		}

		let end = hexes.find(d => d.key == game.end);
		game.bearing = getAngle(end.x - game.selected.x, game.selected.y - end.y);
		setHexes();

		if (game.mode == "daily") {
			history.daily.result = null;
			history.daily.game = JSON.parse(JSON.stringify(game));
			setStorage("hexgame-history", history);
		}

		dataLayer.push({
			event: "gameStart",
			mode: game.mode,
			dataset: game.dataset,
			start: data[game.start].name,
			end: data[game.end].name
		});

		await sleep(50);
		if (game.mode == "fixed") {
			qhigher.focus();
		} else {
			maphexes["next0"].focus();
		}
	}

	async function startDaily() {
		if (history.daily.day == today && history.daily.game) {
			game = JSON.parse(JSON.stringify(history.daily.game));
			status = history.daily.result ? history.daily.result : game.next ? "question" : "select";
			setHexes();
			if(status == "select") {
				await sleep(50);
				maphexes["next0"].focus();
			}
		} else {
			history.daily.day = today;
			startGame();
		}
	}

	function quitGame() {
		status = "mode";
		game.start = null;
		game.end = null;
		game.next = null;
		game.bearing = null;
		game.selected = null;
		game.steps = [];
		game.right = [];
		game.wrong = [];
		game.record = [];
		if (game.mode == "timed") {
			clearInterval(timer);
			clock = 0;
		}
	}

	function randomRoute(random = Math.random) {
		let moves = 10; // Minimum number of moves
		let hexes_ew = hexes.filter(d => ["E", "W"].includes(d.key.slice(0,1)));

		let obj = hexes_ew[Math.floor(random() * hexes_ew.length)]; // Select random start place
		let start = obj.key;

		let arr = []; // Array of places that are at least {moves} away
		hexes_ew.forEach((d) => {
			let dist = Math.sqrt((d.x - obj.x) ** 2 + (d.y - obj.y) ** 2);
			if (dist > (moves - 1) * adjdist) {
				arr.push(d.key);
			}
		});

		let end = arr[Math.floor(random() * arr.length)];

		return {start, end};
	}

	async function resetRoute() {		
		let route = routes.find(d => d.code == game.route);
		if (route.start && route.end) {
			game.start = route.start;
			game.end = route.end;
			game.steps = calcSteps(game.start, game.end, adj);
			await sleep(50);
			setHexes();
		} else if (route.code == "random" || route.code == "daily") {
			let {start, end} = randomRoute(route.code == "daily" ? new Random(today) : Math.random);
			game.start = start;
			game.end = end;
			game.steps = calcSteps(game.start, game.end, adj);
			await sleep(50);
			setHexes();
		} else {
			game.start = game.end = null;
			game.steps = [];
			await sleep(50);
			setHexes();
		}
	}

	function setStatus(status_new) {
		if (status_new == "prev") {
			status = status_prev.pop();
		} else {
			status_prev.push(status);
			status = status_new;
		}
	}
	
	function toggleFullscreen() {
		if (!fullscreen) {
			document.body.requestFullscreen();
			fullscreen = true;
		} else {
			document.exitFullscreen();
			fullscreen = false;
		}
	}

	function toggleHL(e) {
		if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
			if (e.target == qhigher) {
				qlower.focus();
			} else {
				qhigher.focus();
			}
		}
	}

	function cycleMenu(e) {
		if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
			let buttonText = e.target.innerText;
			let buttons = document.getElementById("menu").getElementsByTagName("button");
			let arr = Array.prototype.slice.call(buttons).map(button => button.innerText);
			let index = arr.indexOf(buttonText);
			let newindex = e.key == "ArrowDown" || e.key == "ArrowRight" ? (index + 1) % buttons.length : (index + buttons.length - 1) % buttons.length;
			buttons[newindex].focus();
		}
	}

	function loadHistory() {
		let stored = getStorage("hexgame-history");
		if (stored) {
			history = stored;
		} else {
			history = JSON.parse(JSON.stringify(history_defaults));
			setStorage("hexgame-history", stored);
		}
	}

	async function setStartEnd(e, pos) {
		let other = pos == 'start' ? 'end' : 'start';
		game[pos] = e.detail.key;
		game.steps = game[other] ? calcSteps(game.start, game.end, adj) : [];

		await sleep(50);
		setHexes();

		await sleep(50);
		if (!game[other]) {
			el['select-' + other].getElementsByTagName('input')[0].focus();
		} else {
			el['select-confirm'].focus();
		}
	}

	async function unSelect(start_end) {
		game[start_end] = null;
		game.steps = [];

		await sleep(50);
		setHexes();

		await sleep(50);
		if (start_end == "end" && !game.start) start_end = "start";
		el["select-" + start_end].getElementsByTagName("input")[0].focus();
	}

	function share() {
		let mode = game.mode == "daily" ? `Daily game #${today - zeroday + 1}` : modes.find(d => d.code == game.mode).label;
		let dataset = datasets.find(d => d.code == game.dataset).label;
		let str = `#CensusMapGame | ${mode}
${data[game.start].name} to ${data[game.end].name} | ${dataset}
${game.record.map((d, i) => status == 'won' && i == game.record.length - 1 ? '🟦' : d ? '🟩' : '🟥').join('')}
${status == 'won' ? 'Won' : 'Lost'} in ${game.record.length} turns (shortest route ${game.steps.length - 1}) | ${Math.floor(100 * ((game.right.length - 1) / game.record.length))}% correct
https://bit.ly/census-map-game/`;
		navigator.clipboard.writeText(str)
		.then(() => alert("Copied: " + str));
	}

	// INITIALISE APP

	// Load history
	loadHistory();

	// Load hexes
	fetch(hexurl)
	.then(res => res.json())
	.then(hexjson => {
		let newhexes = renderHexJSON(hexjson, width, height);

		fetch(adjurl)
		.then(res => res.json())
		.then(adjjson => {
			newhexes.forEach(d => {
				d.adj = adjjson[d.key];
			});
			newhexes.sort((a, b) => a.n.localeCompare(b.n));
			hexes = newhexes;
			adj = adjjson;
			if (!history.hexes[hexes[0].key]) {
				history.hexes = Object.fromEntries(hexes.map(hex => [hex.key, {r: 0, w: 0}]));
			}
		});
	});

	// Load data
	getData(dataurl).then((arr) => {
		let obj = {};
		arr.forEach(d => (obj[d.code] = d));

		data = obj;
	});
</script>

<svelte:body bind:this={main}/>

<main>
<header>
	<button on:click={() => setStatus("mode")} class="btn-link btn-title" title="Census Map Game. Return to menu"><h1>Census Map Game</h1></button>
	<nav>
		<button on:click={() => setStatus("info")} title="About the game" use:tooltip><Icon type="info"/></button>
		<button on:click={() => setStatus("scores")} title="View score history" use:tooltip><Icon type="chart"/></button>
		<button on:click={toggleFullscreen} title=" Full screen mode" use:tooltip><Icon type="{fullscreen ? 'full_exit' : 'full'}"/></button>
	</nav>
</header>

{#if data && hexes}
	{#if status === "mode"}
	<div id="breadcrumb"/>
	<div id="q-container">
		<h2><span class="text-lrg">Choose game mode</span></h2>
	</div>
	<div id="game-container">
		<section class="columns flex-reverse">
			<div>
				<div id="menu" role="form" aria-label="Press up or down to choose game mode. Enter to select.">
					<button autofocus bind:this={el['daily-game']} class="btn-menu btn-primary mb-20" on:click={() => { game.mode = "daily"; game.dataset = "population"; game.route = "daily"; resetRoute(); startDaily(); }} on:keydown={cycleMenu}>Daily game</button>
					{#each modes.filter(mode => mode.code != 'daily') as mode}
					<button bind:this={el[mode.code]} class="btn-menu" on:click={() => { game.mode = mode.code; setStatus("dataset"); }} on:keydown={cycleMenu}>{mode.label + ' mode'} <Icon type="chevron" position="right"/></button>
					{/each}
				</div>
			</div>
			<div>
				<h3>About this game</h3>
				<div class="mini-map" style:margin-top="5px" style:height="150px" style:max-width="500px">
					<HexMap
						data={hexes.filter(d => sample_hexes.includes(d.key))}
						route={calcSteps('E06000019', 'E07000236', adj)}
						width={width}
						height={100}
						transform="translate(-320px, -1260px) scale(2)"
						interactive={false}
					/>
				</div>
				<p><strong>Census Map Game</strong> is a guessing game made with 2021 Census data.</p>
				<p><button class="btn-link" on:click={() => setStatus("info")}>Read how to play</button><Icon type="chevron"/></p>
			</div>
		</section>
	</div>
	{:else if status === "dataset"}
	<div id="breadcrumb">
		<span>
			<Icon type="chevron" rotation={180}/><button class="btn-link" on:click={() => setStatus("prev")}>Back</button> |
			<span class="nowrap">{`${modes.find(d => d.code == game.mode).label} mode`}</span>
		</span>
	</div>
	<div id="q-container" aria-live="assertive">
		<h2><span class="text-lrg">Choose dataset</span></h2>
	</div>
	<div id="game-container">
		<section class="columns">
			<div>
				<form
					id="menu"
					on:submit|preventDefault={() => { game.route = "random"; resetRoute(); startGame(); }}
					aria-label="Press up or down to choose dataset. Enter to select.">
					{#each datasets as dataset, i}
					<label class:label-active={game.dataset == dataset.code} bind:this={el['dataset-' + i]}>
						<input type="radio" bind:group={game.dataset} name="scoops" value={dataset.code}>
						{dataset.label}
					</label>
					{/each}
					<button type="submit" class="btn-menu btn-primary mt-10" style:width="100%" on:click={async () => { setStatus("route"); game.route = "map"; resetRoute(); await sleep(50); el['select-start'].getElementsByTagName('input')[0].focus(); }}>Select route</button>
				</form>
			</div>
		</section>
	</div>
	{:else if status === "info"}
	<div id="breadcrumb">
		<span><Icon type="chevron" rotation={180}/><button class="btn-link" on:click={() => setStatus("prev")}>Back</button></span>
	</div>
	<div id="q-container" aria-live="assertive">
		<h2><span class="text-lrg">About the game</span></h2>
	</div>
	<div id="game-container">
		<section class="columns">
			<div>
				<h3>How to play</h3>
				<p><strong>Census Map Game</strong> is a guessing game made with 2021 Census data. Each hexagon on the map is a local authority in England and Wales.</p>
				<div class="mini-map" style:margin-top="5px" style:height="150px" style:max-width="500px">
					<HexMap
						data={hexes.filter(d => sample_hexes.includes(d.key))}
						route={calcSteps('E06000019', 'E07000236', adj)}
						width={width}
						height={100}
						transform="translate(-320px, -1260px) scale(2)"
						interactive={false}
					/>
				</div>
				<p>
					You need to travel from a <mark class="mark-start">start point</mark>
					to an <mark class="mark-end">end point</mark> and guess if 
					the number, for example the number of people who live in an area, is 
					<strong>higher</strong> or <strong>lower</strong> than the previous area. 
					If you guess wrong, you’ll have to choose a different route.
				</p>
			</div>
			<div>
				<h3>Game modes</h3>
				<p><strong>Classic</strong><br/>Find your own route from start to finish. No time limit.</p>
				<p><strong>Beat the clock</strong><br/>The same as classic mode, but with a time limit. The clock gives you 5 seconds per area on your most direct route.</p>
				<p><strong>Daily game</strong><br/>Play a new set route each day, in classic mode.</p>
			</div>
			<div>
				<h3>Credits</h3>
				<p>
					Game developed by the Office for National Statistics (ONS).
					Data from <a href="https://www.ons.gov.uk/releases/initialfindingsfromthe2021censusinenglandandwales/" target="_blank" class="game-ref-link">Census 2021 first release</a>, ONS.
					Coded using <a href="https://svelte.dev/" target="_blank">Svelte</a>.
					<a href="https://github.com/odileeds/hexmaps/" target="_blank">Local authorities hexmap</a> by Open Innovations.
					<a href="https://github.com/olihawkins/d3-hexjson/" target="_blank">Hexmap rendering script</a> by Oli Hawkins.
				</p>
				<div class="logo-block">
					<a href="https://www.ons.gov.uk/" target="_blank" class="logo game-ref-link" style:width="270px">
						<ONSLogo/>
					</a>
					<a href="https://www.ons.gov.uk/census/" target="_blank" class="logo game-ref-link" style:width="160px">
						<CensusLogo/>
					</a>
				</div>
			</div>
		</section>
	</div>
	
	{:else if status === "scores"}
	<div id="breadcrumb">
		<span><Icon type="chevron" rotation={180}/><button class="btn-link" on:click={() => setStatus("prev")}>Back</button></span>
	</div>
	<div id="q-container">
		<h2><span class="text-lrg" aria-live="assertive">Your game history</span></h2>
	</div>
	<div id="game-container">
		<section class="columns flex-reverse">
			<div>
				{#if modes.filter(mode => history.stats[mode.code].won + history.stats[mode.code].lost > 0).length > 0}
				{#each modes.filter(mode => history.stats[mode.code].won + history.stats[mode.code].lost > 0) as mode}
				<h3>{mode.label} {mode.code == 'daily' ? 'game' : 'mode'}</h3>
				<div class="stats-grid">
					<div>
						<span class="text-xl">{history.stats[mode.code].won + history.stats[mode.code].lost}</span>
						<br/>played
					</div>
					<div>
						<span class="text-xl">{history.stats[mode.code].won + history.stats[mode.code].lost > 0 ? (100 * history.stats[mode.code].won / (history.stats[mode.code].won + history.stats[mode.code].lost)).toFixed(0) : 'NA'}%</span>
						<br/>win record
					</div>
					<div>
						<span class="text-xl">{history.stats[mode.code].streak}</span>
						<br/>current streak
					</div>
					<div>
						<span class="text-xl">{history.stats[mode.code].streak_max}</span>
						<br/>max streak
					</div>
				</div>
				<hr/>
				{/each}
				<div class="stats-block" style:margin-top="25px">
					<button class="btn-menu btn-menu-inline" on:click={() => getPNG(mapel, 'CensusMapGame')}><Icon type="save" margin/> Download map</button>
				</div>
				{:else}
				<div class="stats-block">
					<h3>Your game stats will appear here once you've played the game.</h3>
				</div>
				{/if}
				<hr/>
				<div class="stats-block">
					<p>
						Find out more about the <a href="https://www.ons.gov.uk/census" target="_blank" class="game-ref-link">results from Census 2021 on the ONS website.</a>
					</p>
				</div>
			</div>
			<div class="mini-map" bind:this={mapel}>
				<HexMap
					data={hexes}
					{width}
					{height}
					simple
					interactive={false}
					vis={history.hexes}
				/>
				Proportion of correct guesses (all modes)
				<Legend/>
			</div>
		</section>
	</div>
	
	{:else if status === "route"}
	<div id="breadcrumb">
		<span>
			<Icon type="chevron" rotation={180}/><button class="btn-link" on:click={() => setStatus("prev")}>Back</button> |
			<span class="nowrap">{`${modes.find(d => d.code == game.mode).label} mode`} |</span>
			<span class="nowrap">{datasets.find(d => d.code == game.dataset).label}</span>
		</span>
	</div>
	<div id="q-container">
			<div>
				Start<br/>
				<Select
					bind:container={el['select-start']}
					items={hexes.filter(d => !["S", "N"].includes(d.key.slice(0,1)) && d.key != game.end)}
					value={hexes.find(d => d.key == game.start)}
					idKey="key" labelKey="n" placeholder="Select start of route"
					on:select={e => setStartEnd(e, 'start')}
					on:clear={() => unSelect('start')}/>
			</div>
			<div>
				End<br/>
				{#if game.end || game.start}
				<Select
					bind:container={el['select-end']}
					items={hexes.filter(d => !["S", "N"].includes(d.key.slice(0,1)) && d.key != game.start)}
					value={hexes.find(d => d.key == game.end)}
					idKey="key" labelKey="n" placeholder="Select end of route"
					on:select={e => setStartEnd(e, 'end')}
					on:clear={() => unSelect('end')}/>
				{/if}
			</div>
	</div>
	{:else if status === "won" || status === "lost"}
	<div id="breadcrumb">
		<span>
			{#if game.route == 'daily'}
			<span class="nowrap">{`Daily game #${today - zeroday}`} |</span>
			{:else}
			<span class="nowrap">{`${modes.find(d => d.code == game.mode).label} mode`} |</span>
			{/if}
			<span class="nowrap">{datasets.find(d => d.code == game.dataset).label} |</span>
			{`${data[game.start].name} to ${data[game.end].name}`}
		</span>
		<span>
			{#if game.mode != "daily"}
			<button class="btn-link" on:click={startGame}>Replay game</button> <Icon type="replay"/> |
			{/if}
			<button class="btn-link" on:click={quitGame}>Return to menu</button>
		</span>
	</div>
	<div id="q-container" aria-live="assertive">
		<div>
			<span class="text-lrg">{status == "won" ? 'Congratulations!' : 'Oops...'}</span><br />
			<span style:margin-left="2px"><Icon type={status == "won" ? 'tick' : 'cross'} margin/> {status == "won" ? `You made it from ${data[game.start].name} to ${data[game.end].name}` : `You did not make it from ${data[game.start].name} to ${data[game.end].name}`}</span>
		</div>
	</div>
	<div id="game-container">
		<section class="columns flex-reverse">
			<div>
				<h3>Game stats</h3>
				{#if status === 'won'}
				<div class="stats-block">
					You took<br/>
					<span class="text-lrg">{game.record.length} turns</span>
					<span class="muted">(shortest route {game.steps.length - 1} turns)</span>
					<Bar data={[game.record.length]} colors={['#333']}/>
					<Bar data={[game.steps.length - 1, game.record.length + 1 - game.steps.length]} colors={['darkgrey', null]}/>
				</div>
				<hr/>
				{/if}
				<div class="stats-block">
					You scored<br/>
					<span class="text-lrg">{Math.round(100 * ((game.right.length - 1) / game.record.length))}%</span>
					<span class="muted">({game.right.length - 1} correct out of {game.record.length})</span><br/>
					<Bar data={[game.right.length - 1, game.wrong.length]} colors={['#22D0B6', '#F66068']}/>
				</div>
				<hr/>
				{#if game.mode == "daily"}
				<div class="stats-block">
					Next daily game<br/>
					<span class="text-xl" style:line-height={1.1}>
						{String(Math.floor((countdown % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0')} :
						{String(Math.floor((countdown % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0')} :
						{String(Math.floor((countdown % (1000 * 60)) / 1000)).padStart(2, '0')}
					</span>
				</div>
				<hr/>
				{/if}
				<div class="stats-block" style:margin-top="25px">
					<button class="btn-menu btn-menu-inline btn-primary" on:click={share}><Icon type="share" margin/> Share score</button>
					<button class="btn-menu btn-menu-inline" on:click={() => getPNG(mapel, 'CensusMapGame')}><Icon type="save" margin/> Download map</button>
				</div>
				<hr/>
				<div class="stats-block">
					<p>
						Find out more about the <a href="https://www.ons.gov.uk/census" target="_blank" class="game-ref-link">results from Census 2021 on the ONS website.</a>
					</p>
				</div>
			</div>
			<div class="mini-map" bind:this={mapel}>
				<HexMap
					data={hexes}
					{width}
					{height}
					simple
					interactive={false}
				/>
			</div>
		</section>
	</div>

	{:else}
	<div id="breadcrumb">
		<span>
			{#if game.route == 'daily'}
			<span class="nowrap">{`Daily game #${today - zeroday}`} |</span>
			{:else}
			<span class="nowrap">{`${modes.find(d => d.code == game.mode).label} mode`} |</span>
			{/if}
			<span class="nowrap">{datasets.find(d => d.code == game.dataset).label} |</span>
			{`${data[game.start].name} to ${data[game.end].name}`}
			{#if game.mode == "timed"}
			| <strong class="nowrap">{clock} seconds left</strong>
			{/if}
		</span>
		<span><button class="btn-link" on:click={quitGame}>Quit game</button></span>
	</div>
	<div id="q-container">
		<div area-hidden="true">
			<span class="text-lrg">{game.selected.n}</span><br/>
			<strong>{f(data[game.selected.key][game.dataset])}</strong>
			{datasets.find(d => d.code == game.dataset).unit}
		</div>
		{#if !game.next}
		<div>
			<span class="text-lrg">Select next place</span><br/>
			<Icon type="compass" rotation={game.bearing}/>
			Destination is {getCompass(game.bearing)}
		</div>
		{:else}
		<div role="form" aria-label="{
			`You are on ${game.selected.n}, ${datasets.find(d => d.code == game.dataset).label} ${data[game.selected.key][game.dataset]} ${datasets.find(d => d.code == game.dataset).unit}.
			Is the ${datasets.find(d => d.code == game.dataset).label} of ${game.next.n} higher or lower? Press left or right to choose next place. Enter to select.`
			}">
			<span class="text-lrg" aria-hidden="true">{game.next.n}</span><br/>
			<button bind:this={qhigher} on:keydown={toggleHL} on:click={(e) => guess("higher", e)} class="btn-hilo">Higher <Icon type="arrow" rotation={90}/></button>
			<button bind:this={qlower} on:keydown={toggleHL} on:click|preventDefault={(e) => guess("lower", e)} class="btn-hilo">Lower <Icon type="arrow" rotation={-90}/></button>
			<span aria-live="assertive">{message_guess}</span>
		</div>
		{/if}
	</div>
	{/if}

	{#if !["mode", "dataset", "info", "scores", "won", "lost"].includes(status)}
		<div id="game-container" class="noscroll">
			{#if status === "route"}
			<div id="button-container">
				<button class="btn-menu btn-menu-inline" on:click={() => { game.route = "random"; resetRoute(); }}>Random route <Icon type="shuffle"/></button>
				<button class="btn-menu btn-menu-inline btn-primary" disabled={ !game.start || !game.end } on:click={startGame} bind:this={el['select-confirm']}>Start game</button>
			</div>
			{/if}
			<HexMap
				data={hexes}
				next={nexthexes}
				{width}
				selected={game.selected}
				bind:hexes={maphexes}
				on:select={doSelect}
				message={message_select}
			/>
		</div>
	{/if}
{/if}
</main>

<style>
	a {
		color: #206095;
		text-decoration: underline;
	}
	a:hover {
		color: black;
	}
	h1 {
		font-size: 1.8em;
		margin: 0 0 5px 0;
		text-align: left;
		color: white;
	}
	@media(max-width: 440px){
    h1 {
			font-size: 1.55em;
			margin-top: 2px;
    }
  }
	h2 {
		margin: 0 0 5px 0;
	}
	h3 {
		margin: 0;
	}
	hr {
    border: none;
    height: 1px;
    background-color: darkgrey;
	}
	main {
		display: flex;
		flex-direction: column;
		height: 100vh;
		max-height: 100vh;
		margin: 0 auto;
		text-align: center;
		width: 100%;
		max-width: 980px;
		background-color: #44368F;
		background-image: linear-gradient(to right, #44368F, #8C2292);
	}
	header {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		justify-content: space-between;
		flex-wrap: nowrap;
		margin: 0 auto;
		padding: 6px 12px 0 12px;
		width: 100%;
		color: white;
	}
	nav {
		white-space: nowrap;
	}
	nav button:hover {
		color: #bbb;
	}
	#breadcrumb {
		display: flex;
		flex-shrink: 0;
		flex-direction: row;
		align-items: stretch;
		justify-content: space-between;
		width: calc(100% - 8px);
		min-height: 27px;
		background-color: white;
		margin: 0 4px;
		padding: 2px 9px 0 9px;
	}
	#breadcrumb > span:nth-of-type(1) {
		text-align: left;
		flex-grow: 1;
	}
	#breadcrumb > span:nth-of-type(2) {
		text-align: right;
		min-width: 120px;
		flex-grow: 1;
	}
	#game-container {
		box-sizing: border-box;
		flex-grow: 1;
		margin: 0 4px 4px 4px;
		padding: 0;
		position: relative;
		overflow-y: auto;
		width: calc(100% - 8px);
		background-color: white;
	}
	#q-container {
		display: flex;
		width: calc(100% - 8px);
		flex-direction: row;
		align-items: stretch;
		box-sizing: border-box;
		min-height: 85px;
		margin: 0 4px;
		padding: 10px 0;
		border-bottom: none;
		text-align: left;
		background-color: #ddd;
	}
	@media(max-width: 600px){
    #q-container {
			flex-wrap: wrap;
    }
  }
	#q-container > div {
		box-sizing: border-box;
		flex-basis: 100%;
		margin: 0;
		padding: 0 10px;
		vertical-align: top;
		min-height: 65px;
	}
	#q-container > h2 {
		width: 100%;
		text-align: center;
		margin: 0;
	}
	#menu {
		width: 360px;
		max-width: 100%;
		height: calc(100% - 75px);
		margin: 0 auto;
		padding: 20px 0 10px 0;
		text-align: left;
	}
	#button-container {
		position: absolute;
		top: 15px;
		left: 15px;
		text-align: left;
		z-index: 1;
	}
	.columns {
		padding: 0;
		margin: 10px;
  	list-style: none;
  	display: flex;
  	flex-wrap: wrap;
		text-align: left;
	}
	.columns > div {
		width: 300px;
		max-width: 100%;
		padding: 10px;
		flex-grow: 1;
	}
	.flex-reverse {
		flex-direction: row-reverse !important;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-gap: 6px;
		width: 100%;
		margin: 15px 0;
		text-align: center;
	}
	.mini-map {
		position: relative;
		width: 100%;
		height: 100%;
	}
	button {
		cursor: pointer;
		border: none;
		border-radius: 0;
		position: relative;
	}
	header button {
		color: white;
	}
	button:focus {
		outline: 3px solid orange;
	}
	button:disabled {
		background-color: grey;
		cursor: default;
	}
	nav > button {
		background: none;
		border: none;
		font-size: 1.2rem;
		padding: 0.4em 0.1em;
		margin: 0 0 0.5em 0.5em;
	}
	.btn-menu {
		display: block;
		width: 100%;
		height: 40px;
		margin: 0 auto .5em auto;
		background-color: #bcbcbc;
		color: black;
		border: none;
		font-weight: bold;
	}
	.btn-menu:hover {
		background-color: #b0b0b0;
	}
	.btn-primary {
		background-color: #902082;
		color: white;
	}
	.btn-primary:hover {
		background-color: #7d1c71;
	}
	.btn-menu-inline {
		display: inline-block;
		width: auto;
		max-width: auto;
		text-align: left;
		padding: 0.4em 0.8em;
		margin-bottom: 0;
	}
	.btn-link {
		background: none !important;
		border: none;
		padding: 0 !important;
		margin: 0 !important;
		color: #206095;
		font-weight: normal;
		text-decoration: underline;
		cursor: pointer;
	}
	.btn-link:hover {
		color: black;
	}
	.btn-title {
		color: white;
		font-weight: bold !important;
		text-decoration: none;
	}
	.btn-hilo {
		border: 2px solid black;
		margin: 0;
		padding: 0.2em 0.6em;
	}
	.btn-hilo:hover {
		background-color: lightgrey;
	}
	#menu label {
		box-sizing: border-box;
		display: block;
		padding: 0.4em 0.4em 0.4em 2.5em;
		width: 100%;
		border: 1px solid black;
		margin: 0 0 5px 0;
		cursor: pointer;
		position: relative;
	}
	label:focus-within {
		outline: 3px solid orange;
	}
	label:hover {
		background-color: #eee;
	}
	.label-active {
		background-color: #eee;
	}
	.label-active:before {
		content: " ";
		position: absolute;
		z-index: 3;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		border: 1px solid black;
	}
	input[type="radio"] {
    position: absolute;
    margin: 0;
    padding: 0;
    appearance: none;
    border: 2px solid #222;
		background: white;
    height: 22px;
    left: 8px;
    top: 50%;
    width: 22px;
    z-index: 1;
    border-radius: 50%;
    outline: none;
		transform: translateY(-50%);
	}
	input[type="radio"]:checked {
    background: #222;
    box-shadow: inset 0 0 0 3px white;
	}
	.text-lrg {
		font-size: 1.4rem;
		font-weight: bold;
	}
	.text-xl {
		font-size: 2.2rem;
		font-weight: bold;
	}
	.mt-10 {
		margin-top: 10px;
	}
	.mb-20 {
		margin-bottom: 20px;
	}
	mark {
		font-weight: bold;
		color: white;
		padding: 0 0.2em;
	}
	.mark-start {
		background-color: #22D0B6;
	}
	.mark-end {
		background-color: #206095;
	}
	.nowrap {
		white-space: nowrap;
	}
	.stats-block {
		margin: 20px 0 25px 0;
	}
	.muted {
		color: #777;
	}
	.logo-block {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: center;
		max-width: 100%;
	}
	.logo {
		cursor: pointer;
		padding: 2px;
		margin: 0;
		line-height: 1;
	}
	.noscroll {
		overflow-y: hidden !important;
	}
</style>
