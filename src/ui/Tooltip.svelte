<script>
	export let title;
	export let x;
	export let y;
  export let width;

  let w;

  const xPad = 4;

  $: xPos = w && x + (w / 2) > width - xPad ? width - (w / 2) - xPad : w && x - (w / 2) < 0 + xPad ? (w / 2) + xPad : x;
</script>

<div class="tooltip" style:top="{y}px" style:left="{xPos}px" bind:clientWidth={w}>
  {title}
  <div class="caret" style:transform="translateX({(w / x) + (x - xPos)}px)"></div>
</div>


<style>
	.tooltip {
		background: #333;
		color: white;
		border-radius: 2px;
		padding: 4px;
		position: absolute;
		transform: translate(-50%,7px);
    font-size: 0.85em;
    white-space: nowrap;
	}
	.caret {
		content: " ";
		position: absolute;
		bottom: 100%;  /* At the top of the tooltip */
		left: 50%;
		margin-left: -5px;
		border-width: 5px;
		border-style: solid;
		border-color: transparent transparent #333 transparent;
	}
</style>