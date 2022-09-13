import Tooltip from './Tooltip.svelte';

export default function tooltip(element) {
	let title;
	let tooltipComponent;
	function mouseOver(event) {
		// NOTE: remove the `title` attribute, to prevent showing the default browser tooltip
		// remember to set it back on `mouseleave`
		title = element.getAttribute('title');
		element.removeAttribute('title');

    let body = document.body.getBoundingClientRect();
		let pos = element.getBoundingClientRect();
		let y = pos.bottom - 3;
		let x = (pos.left + pos.right) / 2;

		tooltipComponent = new Tooltip({
			props: {
				title: title,
				x: x,
				y: y,
				width: body.width
			},
			target: document.body,
		});
	}
	function mouseLeave() {
		tooltipComponent.$destroy();
		// NOTE: restore the `title` attribute
		element.setAttribute('title', title);
	}
	
	element.addEventListener('mouseover', mouseOver);
  	element.addEventListener('mouseleave', mouseLeave);
	
	return {
		destroy() {
			if (tooltipComponent) tooltipComponent.$destroy();
			element.removeEventListener('mouseover', mouseOver);
			element.removeEventListener('mouseleave', mouseLeave);
		}
	}
}