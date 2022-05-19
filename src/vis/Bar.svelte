<script>
  export let data;
  export let colors = ['grey'];

  let blocks = [];
  data.forEach((val, i) => {
    for (let j = 0; j < val; j ++) {
      blocks.push(colors[i % colors.length]);
    }
  });
</script>

<div class="bar-group">
  {#each blocks as block, i}
  {#if block}
  <div style:left="{100 *(i / blocks.length)}%" style:width="calc({100 * (1 / blocks.length)}% - 1.5px)" style:background-color="{block}"/>
  {/if}
  {/each}
</div>

<style>
  .bar-group {
		display: block;
		position: relative;
		width: 100%;
		height: 15px;
    margin-bottom: 1.5px;
	}
	.bar-group > div {
		position: absolute;
		height: 100%;
		top: 0;
	}
</style>