<script>
	export let value = null;
	export let lineWidth = 3;
	export let height = 10;
	export let breaks = [0,20,40,60,80,100];
	export let colors = ['#f66068', '#ef9f91', '#dbd6bd', '#8ebdb2', '#00a3a6'];
  export let suffix = "%";
	export let snapticks = true;
	
	const pos = (val) => {
		let i = 0;
		while (val > breaks[i + 1]) i += 1;
		let unit = 100 / (breaks.length - 1);
		let offset = (val - breaks[i]) / (breaks[i + 1] - breaks[i]);
		return (i + offset) * unit;
	}
</script>

<div class="container" style="height: {height}px">
	{#each breaks.slice(1) as brk, i}
		<div class="block" style:width="{100 / (breaks.length - 1)}%" style:left="{i * (100 / (breaks.length - 1))}%" style:background-color="{colors[i % colors.length]}"/>
		<div class="line" style:left="{i * (100 / (breaks.length - 1))}%"/>
		<div class="tick" style:left="{i * (100 / (breaks.length - 1))}%" style:transform="translateX({snapticks && i == 0 ? '-1px' : '-50%'})">{breaks[i]}</div>
	{/each}
	<div class="line" style:right="0"/>
	<div class="tick" style:left="100%" style:transform="translateX({snapticks ? 'calc(-100% + 1px)' : '-50%'})">{breaks[breaks.length - 1]}{suffix}</div>
  {#if value}
	  <div class="marker" style:width="{lineWidth}px" style:left="calc({pos(value)}% - {lineWidth / 2}px)"/>
	  <div class="value" style:left="{pos(value)}%">{value}</div>
  {/if}
</div>

<style>
	.container {
		margin: 4px 0 28px 0;
		box-sizing: border-box;
		position: relative;
		width: 100%;
	}
	.block {
		position: absolute;
		top: 0;
		height: 100%;
	}
	.line {
		position: absolute;
		top: 0;
		height: calc(100% + 10px);
		border-left: solid 1px black;
	}
	.tick {
		position: absolute;
		z-index: 1;
		top: calc(100% + 8px);
		text-align: center;
	}
	.marker {
		position: absolute;
		z-index: 2;
		top: -10px;
		height: calc(100% + 10px);
		background-color: black;
	}
	.value {
		position: absolute;
		top: -32px;
		text-align: center;
		transform: translateX(-50%);
	}
</style>