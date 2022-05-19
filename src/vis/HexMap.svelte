<script>
	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher();
	import { select } from 'd3-selection';
	import { zoom } from 'd3-zoom';
	import Icon from '../ui/Icon.svelte';
	
	export let data;
	export let next = null;
	export let selected = null;
	export let simple = false;
	export let interactive = true;
	export let el = undefined; // DOM element for map container
	export let hexes = {}; // DOM elements for hexes
	export let width = 100;
	export let height = 100;
	export let transform = null;
	export let route = null;
	export let vis = null;
	export let message = null;

	const colors = ['#f66068', '#bf7574', '#808080', '#69a89b', '#22d0b6'];
	const breaks = [0, 20, 40, 60, 80, 100];

	let next_index = 0;
	let hexdata;

	let svg
	let w, h;
	let x, y, z;

	const _zoom = zoom().on('zoom', ({ transform }) => {
		z = transform.k;
		x = transform.x;
		y = transform.y;
	}).scaleExtent([0.5, 2]);

	const doZoom = (factor) => _zoom.scaleBy(select(svg).transition().duration(500), factor);
	
	function makePoints(vertices) {
		let points = [];
		vertices.forEach(d => points.push(d.x + ',' + d.y));
		return points.join(' ');
	}
	
	function onClick(e, d) {
		dispatch('select', {
			code: d.key,
			obj: d,
			event: e
		});
	}

	function onKeydown(e, d) {
		if ([" ", "Enter", "Spacebar"].includes(e.key)) {
			onClick(e, d);
			next_index = 0;
		} else if (["ArrowRight", "ArrowDown"].includes(e.key)) {
			next_index = next_index + 1 == next.length ? 0 : next_index + 1;
			hexes['next' + next_index].focus();
		} else if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
			next_index = next_index - 1 < 0 ? next.length - 1 : next_index - 1;
			hexes['next' + next_index].focus();
		}
	}

	function getStatus(key, route) {
		if (key == route[0]) {
			return "start";
		} else if (key == route[route.length - 1]) {
			return "end";
		} else if (route.includes(key)) {
			return "route";
		} else {
			return "";
		}
	}

	function setHexColors() {
		let keys = Object.keys(vis);
		let hexdata_new = {};
		for (const key of keys) {
			let value = ["S", "N"].includes(key.slice(0,1)) ? null : 100 * vis[key].r / (vis[key].r + vis[key].w);
			hexdata_new[key] = {value, color: getColor(value, colors, breaks)};
		}
		hexdata = hexdata_new;
	}

	function getColor(val, colors, breaks) {
		if (val != null) {
			for (let i = 1; i < breaks.length; i ++) {
				if (val <= breaks[i]) {
					return colors[i - 1];
				}
			}
		} else {
			return "lightgrey";
		}
	}

	if (vis) setHexColors();
	
	onMount(async () => {
		if (interactive) {
			select(svg).call(_zoom);
			reCenter(selected, 1000);
		}
	});
	
	function reCenter(selected, duration=500) {
		if (interactive && selected && hexes[selected.key]) {
			_zoom.translateTo(select(svg).transition().duration(duration), selected.x, selected.y);
		}
	}
	
	$: reCenter(selected);
</script>

{#if interactive}
<div class="control">
	<button on:click={() => doZoom(2)} title="Zoom in"><div class="icon"><Icon type="plus"/></div></button>
	<button on:click={() => doZoom(0.5)} title="Zoom out"><div class="icon"><Icon type="minus"/></div></button>
</div>
{/if}

<div
	bind:this={el}
	bind:clientWidth={w}
	bind:clientHeight={h}
	class="map"
	class:pos-absolute={!simple}
	aria-hidden="{simple || !interactive ? 'true' : 'false'}">
	<svg viewBox="0 0 {interactive ? w : width} {interactive ? h : height}" xmlns="http://www.w3.org/2000/svg" bind:this={svg}>
		<g style:transform="{transform ? transform : `translate(${x}px, ${y}px) scale(${z})`}">
			{#each data as d}
			<g on:click="{!simple && d.status != 'disabled' ? (e) => onClick(e, d) : null}" bind:this={hexes[d.key]} class="{!route ? d.status : vis ? '' : getStatus(d.key, route)}" transform="translate({d.x} {d.y})">
				<polygon class="hex" points="{makePoints(d.vertices)}" style:fill={vis ? hexdata[d.key].color : null} style:stroke={vis ? hexdata[d.key].color : null}/>
				{#if !simple}
				<text class="text" aria-hidden="true">{d.n.slice(0,1)}</text>
				{/if}
				<title>{d.n}{vis ? ` ${hexdata[d.key].value}%` : ''}</title>
			</g>
			{/each}
			{#if next && next[0]}
			<g
				bind:this={hexes['nextgroup']}
				role={message ? 'form' : ''}
				aria-label={message}>
				{#each next as d, i}
				<g role="button" tabindex={i == next_index ? 0 : -1} on:click="{(e) => onClick(e, d)}" on:keydown="{(e) => onKeydown(e, d)}" bind:this={hexes['next' + i]} class="adjacent-button" transform="translate({d.x} {d.y})">
					<polygon class="hex" points="{makePoints(d.vertices)}"/>
					{#if i == next_index}<polygon class="hex outline" points="{makePoints(d.vertices)}"/>{/if}
					<text class="text" aria-hidden="true">{d.n.slice(0,1)}</text>
					<title>{`${d.n}, ${d.direction}`}</title>
				</g>
				{/each}
			</g>
			{/if}
		</g>
	</svg>
</div>

<style>
	.hex {
		fill: darkgrey;
		stroke: darkgrey;
		stroke-width: 4px;
		transform: scale(0.82);
	}
	.text {
		fill: white;
		font-family: 'Orbitron', sans-serif;
		font-size: 16px;
		font-weight: bold;
		text-anchor: middle;
		dominant-baseline: middle;
		pointer-events: none;
	}
	.start > polygon, .selected > polygon, .right > polygon {
		fill: #22D0B6;
		stroke: #22D0B6;
	}
	.wrong > polygon {
		fill: #F66068;
		stroke: #F66068;
	}
	.wrong > text {
		opacity: 0.4;
	}
	.next > polygon {
		fill: grey;
		stroke: #22D0B6;
	}
	.end > polygon {
		fill: #206095;
		stroke: #206095;
	}
	.route > polygon {
		fill: grey;
		stroke: grey;
	}
	.adjacent {
		display: none;
	}
	.adjacent-button {
		cursor: pointer;
		outline: none;
	}
	.adjacent-button > .hex, .adjacent-button > text {
		animation: blink 1s linear infinite;
	}
	.adjacent-button:focus > .outline {
		animation: none;
		fill: none;
		stroke: orange;
	}
	.disabled > polygon {
		fill: #ddd;
		stroke: #ddd;
	}
	.adjacent-button > .hex, .adjacent-button > text {
		animation: blink 1s linear infinite;
	}
	.adjacent-button:focus > .outline {
		animation: none;
		fill: none;
		stroke: orange;
	}
	.disabled > polygon {
		fill: #ddd;
		stroke: #ddd;
	}
	.selectable {
		cursor: pointer;
	}
	.map {
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
	}
	.pos-absolute {
		position: absolute;
	}
	svg {
		position: relative;
		width: 100%;
		height: 100%;
		transform: translateY(5px);
	}
	.control {
		position: absolute;
		top: 15px;
		right: 15px;
		z-index: 1;
	}
	.control > button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: 36px;
		height: 36px;
		font-size: 0.9em;
		font-weight: bold;
		line-height: 0;
		clear: right;
    float: right;
		margin: 0 0 5px 0;
		border: 2px solid #777;
		cursor: pointer;
	}
	@keyframes blink {
		50% {
			opacity: 0.2;
		}
	}
	.icon {
		transform: translateY(-2px);
	}
</style>