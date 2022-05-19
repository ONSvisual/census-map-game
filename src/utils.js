import { csvParse, autoType } from "d3-dsv";
import html2canvas from "html2canvas";

export async function getData(url) {
  let response = await fetch(url);
  let string = await response.text();
	let data = await csvParse(string, autoType);
  return data;
}

export function capitalise(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getAngle(x, y) {
	return Math.atan2(y, x) * 180 / Math.PI;	
}

export function getCompass(angle) {
	if (Math.abs(angle) <= 22.5) {
		return "east";
	} else if (angle > 22.5 && angle <= 67.5) {
		return "northeast";
	} else if (angle > 67.5 && angle <= 112.5) {
		return "north";
	} else if (angle > 112.5 && angle <= 157.5) {
		return "northwest";
	} else if (Math.abs(angle) > 157.5) {
		return "west";
	} else if (angle < -112.5 && angle >= -157.5) {
		return "southwest";
	} else if (angle < -67.5 && angle >= -112.5) {
		return "south";
	} else {
		return "southeast";
	}
}

export function getAdjacents(data) {
	let adj = {};
	data.forEach(d => {
		adj[d.key] = [];
		data.forEach(e => {
			let found = false;
			d.vertices.forEach(dv => {
				let dx = (d.x + dv.x).toFixed(3);
				let dy = (d.y + dv.y).toFixed(3);
				e.vertices.forEach(ev => {
					let ex = (e.x + ev.x).toFixed(3);
					let ey = (e.y + ev.y).toFixed(3);
					if (dx == ex && dy == ey && d.key != e.key) {
						found = true;
					}
				});
			});
			if (found) {
				adj[d.key].push(e.key);
			}
		});
	});
return adj;
}

export function calcSteps(start, end, adj, prev = []) {
	let visited = [start]; // Array of area codes visited
	let rings = [[start]]; // Area codes grouped by number of steps from {start}
	let found = false; // True if {end} code reached
	let deadend = false; // True if no more adjacent hexes left
	let steps = [];

	// "Flood fill" the board to calculate number of steps to {end}
	let i = 0; // Current step
	while (!found && !deadend) {
		rings.push([]);
		for (const code of rings[i]) {
			for (const adj_code of adj[code]) {
				if (!visited.includes(adj_code) && !prev.includes(adj_code)) {
					visited.push(adj_code);
					rings[i + 1].push(adj_code);
				}
			}
		}
		if (visited.includes(end)) {
			found = true;
		} else if (!rings[i + 1][0]) {
			deadend = true;
		}
		i ++;
	}

	// Trace back a valid route from {end} back to {start} using rings
	if (!deadend) {
		let step = end;
		steps.push(end);

		for (let i = rings.length - 2; i >= 0; i -- ) {
			let neighbours = rings[i].filter(d => adj[step].includes(d));
			let prev = neighbours[0];
			steps.unshift(prev);
			step = prev;
		}
	}

	return deadend ? null : steps;
}

export function sleep (ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function iniframe (window) {
	try {
		return window.self !== window.top;
	} catch (e) {
		return true;
	}
}

export function setStorage(name, value) {
	let val = JSON.stringify(value);
	localStorage.setItem(name, val);
}

export function getStorage(name) {
	if (localStorage.getItem(name)) {
		return JSON.parse(localStorage.getItem(name));
	}
	return null;
}

export function deleteStorage(name) {
	localStorage.removeItem(name);
}

export function getPNG(target, filename) {
  html2canvas(target)
  .then(canvas => {
    let content = canvas.toDataURL();
    download(content, filename + '.png');
  });
}

function download(content, filename) {
  var a = document.createElement('a');
  a.href = content;
  a.download = filename;
  a.click();
}